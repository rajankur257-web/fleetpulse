import { Injectable } from '@nestjs/common';
import {
  Assignment,
  DeliveryRequest,
  DispatchContext,
  DispatchStrategy,
  DispatchStrategyType,
  Driver,
  DriverStatus,
  haversineKm,
} from '@fleet-pulse/shared';

export interface ScoredCandidate {
  driver: Driver;
  distanceKm: number;
  score: number;
}

@Injectable()
export class ScoredStrategy implements DispatchStrategy {
  readonly name = DispatchStrategyType.SCORED;

  // Default weights sum to 1.0
  private static readonly DEFAULT_WEIGHTS = {
    distance: 0.4,
    rating: 0.3,
    idleTime: 0.2,
    dailyTrips: 0.1,
  };

  assign(
    request: DeliveryRequest,
    candidates: Driver[],
    context?: DispatchContext,
  ): Assignment | null {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    const availableCandidates = candidates.filter(
      (driver) => driver.status === DriverStatus.AVAILABLE,
    );

    if (availableCandidates.length === 0) {
      return null;
    }

    const weights = context?.weights ?? ScoredStrategy.DEFAULT_WEIGHTS;
    const now = (context?.now ?? new Date()).getTime();

    const requestCoord = {
      lat: request.pickupLat,
      lng: request.pickupLng,
    };

    let bestCandidate: ScoredCandidate | null = null;

    for (const driver of availableCandidates) {
      const distance = haversineKm(requestCoord, {
        lat: driver.lat,
        lng: driver.lng,
      });

      // 1. Distance factor: normalized 1 / (1 + distanceKm)
      const distScore = 1 / (1 + Math.max(0, distance));

      // 2. Rating factor: 0.0 - 5.0 normalized to 0.0 - 1.0
      const ratingScore = Math.min(Math.max((driver.rating ?? 5.0) / 5.0, 0), 1);

      // 3. Idle time factor: minutes idle since lastLocationAt, normalized up to 60 minutes
      let idleMinutes = 0;
      if (driver.lastLocationAt) {
        const lastLocationTime = new Date(driver.lastLocationAt).getTime();
        idleMinutes = Math.max(0, (now - lastLocationTime) / (1000 * 60));
      }
      const idleScore = Math.min(idleMinutes / 60, 1.0);

      // 4. Daily trips fairness: drivers with fewer trips get higher score
      const dailyTrips = driver.dailyTrips ?? 0;
      const tripsScore = 1 / (1 + Math.max(0, dailyTrips));

      // Composite weighted score
      const totalScore =
        weights.distance * distScore +
        weights.rating * ratingScore +
        weights.idleTime * idleScore +
        weights.dailyTrips * tripsScore;

      if (!bestCandidate || totalScore > bestCandidate.score) {
        bestCandidate = {
          driver,
          distanceKm: distance,
          score: totalScore,
        };
      }
    }

    if (!bestCandidate) {
      return null;
    }

    return {
      requestId: request.id,
      driverId: bestCandidate.driver.id,
      strategy: this.name,
      distanceKm: bestCandidate.distanceKm,
      score: Math.round(bestCandidate.score * 10000) / 10000,
      assignedAt: context?.now ?? new Date(),
    };
  }
}
