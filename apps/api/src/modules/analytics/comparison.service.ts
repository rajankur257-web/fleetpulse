import { Injectable } from '@nestjs/common';
import {
  AlgorithmComparisonResponse,
  DeliveryRequest,
  DispatchStrategyType,
  Driver,
  DriverStatus,
  RequestStatus,
  StrategyComparisonMetrics,
  haversineKm,
} from '@fleet-pulse/shared';
import { SeededPRNG } from '../simulator/prng';
import { BENGALURU_HOTSPOTS } from '../simulator/simulator.types';
import { NearestDriverStrategy } from '../dispatch/strategies/nearest-driver.strategy';
import { ScoredStrategy } from '../dispatch/strategies/scored.strategy';
import { BatchStrategy } from '../dispatch/strategies/batch.strategy';

export interface ComparisonRunOptions {
  seed?: number;
  driverCount?: number;
  requestCount?: number;
}

@Injectable()
export class ComparisonService {
  constructor(
    private readonly nearestStrategy: NearestDriverStrategy,
    private readonly scoredStrategy: ScoredStrategy,
    private readonly batchStrategy: BatchStrategy,
  ) {}

  /**
   * Deterministically replays the same simulated scenario across Nearest, Scored, and Batch strategies
   */
  async runComparison(options: ComparisonRunOptions = {}): Promise<AlgorithmComparisonResponse> {
    const seed = options.seed ?? 42;
    const driverCount = options.driverCount ?? 40;
    const requestCount = options.requestCount ?? 25;

    // 1. Generate fixed drivers using SeededPRNG
    const prng = new SeededPRNG(seed);
    const initialDrivers: Driver[] = [];

    for (let i = 1; i <= driverCount; i++) {
      const hub = BENGALURU_HOTSPOTS[(i - 1) % BENGALURU_HOTSPOTS.length]!;
      const lat = hub.lat + prng.range(-0.015, 0.015);
      const lng = hub.lng + prng.range(-0.015, 0.015);
      const rating = Math.round(prng.range(4.0, 5.0) * 10) / 10;

      initialDrivers.push({
        id: `driver-sim-${i}`,
        name: `Driver #${i}`,
        phone: `+91980000${String(1000 + i).slice(-4)}`,
        status: DriverStatus.AVAILABLE,
        rating,
        lat,
        lng,
        dailyTrips: prng.intRange(0, 5),
      });
    }

    // 2. Generate fixed delivery requests
    const initialRequests: DeliveryRequest[] = [];
    for (let j = 1; j <= requestCount; j++) {
      const pickupHub = BENGALURU_HOTSPOTS[prng.intRange(0, BENGALURU_HOTSPOTS.length - 1)]!;
      let dropHub = BENGALURU_HOTSPOTS[prng.intRange(0, BENGALURU_HOTSPOTS.length - 1)]!;
      while (dropHub.name === pickupHub.name) {
        dropHub = BENGALURU_HOTSPOTS[prng.intRange(0, BENGALURU_HOTSPOTS.length - 1)]!;
      }

      initialRequests.push({
        id: `request-sim-${j}`,
        pickupLat: pickupHub.lat + prng.range(-0.01, 0.01),
        pickupLng: pickupHub.lng + prng.range(-0.01, 0.01),
        dropLat: dropHub.lat + prng.range(-0.01, 0.01),
        dropLng: dropHub.lng + prng.range(-0.01, 0.01),
        status: RequestStatus.PENDING,
        priority: prng.intRange(1, 3),
      });
    }

    // 3. Evaluate each strategy independently with clean state
    const nearestMetrics = this.evaluateSequential(
      this.nearestStrategy,
      this.cloneDrivers(initialDrivers),
      initialRequests,
      DispatchStrategyType.NEAREST,
    );

    const scoredMetrics = this.evaluateSequential(
      this.scoredStrategy,
      this.cloneDrivers(initialDrivers),
      initialRequests,
      DispatchStrategyType.SCORED,
    );

    const batchMetrics = this.evaluateBatch(
      this.cloneDrivers(initialDrivers),
      initialRequests,
    );

    return {
      seed,
      driverCount,
      requestCount,
      strategies: {
        [DispatchStrategyType.NEAREST]: nearestMetrics,
        [DispatchStrategyType.SCORED]: scoredMetrics,
        [DispatchStrategyType.BATCH]: batchMetrics,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private cloneDrivers(drivers: Driver[]): Driver[] {
    return drivers.map((d) => ({ ...d }));
  }

  private evaluateSequential(
    strategy: NearestDriverStrategy | ScoredStrategy,
    drivers: Driver[],
    requests: DeliveryRequest[],
    strategyType: DispatchStrategyType,
  ): StrategyComparisonMetrics {
    let matched = 0;
    let totalPickupDist = 0;
    let totalDeliveryDist = 0;
    let totalAssignedSeconds = 0;

    for (const req of requests) {
      const available = drivers.filter((d) => d.status === DriverStatus.AVAILABLE);
      if (available.length === 0) break;

      const assignment = strategy.assign(req, available);
      if (assignment) {
        matched++;
        const pickupDist = assignment.distanceKm;
        const tripDist = haversineKm(
          { lat: req.pickupLat, lng: req.pickupLng },
          { lat: req.dropLat, lng: req.dropLng },
        );

        totalPickupDist += pickupDist;
        totalDeliveryDist += tripDist;

        // Simulated assignment decision time (nearest is fast, scored considers weights)
        const decisionSeconds = strategyType === DispatchStrategyType.NEAREST ? 1.2 : 2.4;
        totalAssignedSeconds += decisionSeconds;

        // Mark driver busy for the remainder of this simulation cycle
        const driver = drivers.find((d) => d.id === assignment.driverId);
        if (driver) {
          driver.status = DriverStatus.BUSY;
        }
      }
    }

    const avgPickupDistanceKm =
      matched > 0 ? Math.round((totalPickupDist / matched) * 100) / 100 : 0;
    const avgAssignmentTimeSeconds =
      matched > 0 ? Math.round((totalAssignedSeconds / matched) * 10) / 10 : 0;
    const totalDistanceKm =
      Math.round((totalPickupDist + totalDeliveryDist) * 100) / 100;
    const driverUtilizationRate =
      drivers.length > 0 ? Math.round((matched / drivers.length) * 100) / 100 : 0;

    // Acceptance rate is higher when pickup distance is closer
    const acceptanceRate =
      avgPickupDistanceKm < 4.0 ? 0.92 : avgPickupDistanceKm < 7.0 ? 0.85 : 0.74;

    return {
      strategy: strategyType,
      requestsMatched: matched,
      requestsUnmatched: requests.length - matched,
      avgAssignmentTimeSeconds,
      avgPickupDistanceKm,
      totalDistanceKm,
      driverUtilizationRate,
      acceptanceRate,
    };
  }

  private evaluateBatch(
    drivers: Driver[],
    requests: DeliveryRequest[],
  ): StrategyComparisonMetrics {
    let matched = 0;
    let totalPickupDist = 0;
    let totalDeliveryDist = 0;

    const available = drivers.filter((d) => d.status === DriverStatus.AVAILABLE);

    // Run Hungarian batch optimization
    const assignments = this.batchStrategy.assignBatch(requests, available);

    for (const a of assignments) {
      matched++;
      totalPickupDist += a.distanceKm;

      const req = requests.find((r) => r.id === a.requestId);
      if (req) {
        totalDeliveryDist += haversineKm(
          { lat: req.pickupLat, lng: req.pickupLng },
          { lat: req.dropLat, lng: req.dropLng },
        );
      }

      const driver = drivers.find((d) => d.id === a.driverId);
      if (driver) {
        driver.status = DriverStatus.BUSY;
      }
    }

    const avgPickupDistanceKm =
      matched > 0 ? Math.round((totalPickupDist / matched) * 100) / 100 : 0;
    // Batch accumulation window gives steady assignment time ~5.0s
    const avgAssignmentTimeSeconds = 5.0;
    const totalDistanceKm =
      Math.round((totalPickupDist + totalDeliveryDist) * 100) / 100;
    const driverUtilizationRate =
      drivers.length > 0 ? Math.round((matched / drivers.length) * 100) / 100 : 0;
    const acceptanceRate = 0.95; // Hungarian gives global closest matches, highest acceptance

    return {
      strategy: DispatchStrategyType.BATCH,
      requestsMatched: matched,
      requestsUnmatched: requests.length - matched,
      avgAssignmentTimeSeconds,
      avgPickupDistanceKm,
      totalDistanceKm,
      driverUtilizationRate,
      acceptanceRate,
    };
  }
}
