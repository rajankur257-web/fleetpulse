import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { Socket, io } from 'socket.io-client';
import {
  Coordinates,
  DriverStatus,
  RequestStatus,
  haversineKm,
} from '@fleet-pulse/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DriversService } from '../drivers/drivers.service';
import { RequestsService } from '../requests/requests.service';
import { OfferCascadeService } from '../realtime/cascade/offer-cascade.service';
import { OsrmService } from '../analytics/osrm.service';
import { SeededPRNG } from './prng';
import {
  BENGALURU_BOUNDS,
  BENGALURU_HOTSPOTS,
  Hotspot,
  REAL_DRIVER_NAMES,
  SimDriverAgent,
  SimulatorConfig,
  SimulatorStats,
} from './simulator.types';

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

function movePosition(
  lat: number,
  lng: number,
  headingDeg: number,
  distanceKm: number,
): { lat: number; lng: number } {
  const dLat = (distanceKm / 111.32) * Math.cos((headingDeg * Math.PI) / 180);
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng = (distanceKm / (111.32 * (cosLat === 0 ? 0.0001 : cosLat))) * Math.sin((headingDeg * Math.PI) / 180);
  return { lat: lat + dLat, lng: lng + dLng };
}

@Injectable()
export class SimulatorService implements OnModuleDestroy {
  private readonly logger = new Logger(SimulatorService.name);

  private running = false;
  private config: SimulatorConfig = {
    driverCount: 100,
    speedMultiplier: 1,
    requestRatePerMinute: 10,
    acceptProbability: 0.8,
    seed: 42,
  };

  private prng = new SeededPRNG(42);
  private driverAgents: SimDriverAgent[] = [];
  private dispatcherSocket?: Socket;

  private startTime = 0;
  private simIntervalTimer?: NodeJS.Timeout;
  private requestIntervalTimer?: NodeJS.Timeout;
  private autoStopTimer?: NodeJS.Timeout;

  // Real-time statistics counters
  private stats: SimulatorStats = {
    running: false,
    driverCount: 0,
    speedMultiplier: 1,
    elapsedSeconds: 0,
    requestsCreated: 0,
    requestsAssigned: 0,
    requestsCompleted: 0,
    requestsExpired: 0,
    requestsCancelled: 0,
    doubleAssignmentsDetected: 0,
    availableDrivers: 0,
    busyDrivers: 0,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly driversService: DriversService,
    private readonly requestsService: RequestsService,
    private readonly offerCascadeService: OfferCascadeService,
    private readonly configService: ConfigService,
    private readonly osrmService: OsrmService,
  ) {}

  async onModuleDestroy() {
    await this.stop();
  }

  getDrivers(): SimDriverAgent[] {
    return this.driverAgents;
  }

  getStatus(): SimulatorStats {
    const elapsedSeconds = this.running
      ? Math.round((Date.now() - this.startTime) / 1000)
      : this.stats.elapsedSeconds;

    let availableCount = 0;
    let busyCount = 0;
    const activeTrips = new Set<string>();
    let duplicates = 0;

    for (const d of this.driverAgents) {
      if (d.status === 'available') {
        availableCount++;
      } else if (d.status === 'busy') {
        busyCount++;
        if (d.currentTrip) {
          if (activeTrips.has(d.currentTrip.requestId)) {
            duplicates++;
          }
          activeTrips.add(d.currentTrip.requestId);
        }
      }
    }

    return {
      ...this.stats,
      running: this.running,
      driverCount: this.driverAgents.length,
      speedMultiplier: this.config.speedMultiplier,
      elapsedSeconds,
      availableDrivers: availableCount,
      busyDrivers: busyCount,
      doubleAssignmentsDetected: this.stats.doubleAssignmentsDetected + duplicates,
    };
  }

  /**
   * Starts the fleet simulation with the specified configuration
   */
  async start(config: Partial<SimulatorConfig> = {}): Promise<SimulatorStats> {
    if (this.running) {
      this.logger.warn('Simulator is already running');
      return this.getStatus();
    }

    this.config = {
      ...this.config,
      ...config,
    };

    this.prng = new SeededPRNG(this.config.seed ?? 42);
    this.running = true;

    this.logger.log(
      `Starting Fleet Simulator with ${this.config.driverCount} drivers at ${this.config.speedMultiplier}x speed (seed=${this.config.seed})`,
    );

    // 1. Initialize or load simulated drivers
    await this.initializeDrivers(this.config.driverCount);

    this.startTime = Date.now();
    this.stats = {
      running: true,
      driverCount: this.config.driverCount,
      speedMultiplier: this.config.speedMultiplier,
      elapsedSeconds: 0,
      requestsCreated: 0,
      requestsAssigned: 0,
      requestsCompleted: 0,
      requestsExpired: 0,
      requestsCancelled: 0,
      doubleAssignmentsDetected: 0,
      availableDrivers: this.config.driverCount,
      busyDrivers: 0,
    };

    // 2. Start simulation movement loop (every 1 second)
    let stepping = false;
    this.simIntervalTimer = setInterval(() => {
      if (!this.running || stepping) return;
      stepping = true;
      try {
        this.stepMovement(1);
      } finally {
        stepping = false;
      }
    }, 1000);

    // 3. Start delivery request generator loop with concurrency backpressure
    if (this.config.requestRatePerMinute > 0) {
      const intervalMs = Math.max(
        100,
        Math.round(60000 / (this.config.requestRatePerMinute * this.config.speedMultiplier)),
      );
      let inFlight = 0;
      this.requestIntervalTimer = setInterval(() => {
        if (!this.running || inFlight >= 2) return;
        inFlight++;
        this.stepRequestGeneration()
          .catch((err) => {
            this.logger.error(`Error in request generation step: ${err.message}`);
          })
          .finally(() => {
            inFlight--;
          });
      }, intervalMs);
    }

    // 4. Optional auto-stop timer
    if (this.config.durationSeconds && this.config.durationSeconds > 0) {
      this.autoStopTimer = setTimeout(() => {
        this.logger.log(`Simulation reached scheduled duration of ${this.config.durationSeconds}s. Stopping.`);
        this.stop().catch((e) => this.logger.error(`Error in auto-stop: ${e}`));
      }, this.config.durationSeconds * 1000);
    }

    return this.getStatus();
  }

  /**
   * Stops the active simulation and cleans up connections
   */
  async stop(): Promise<SimulatorStats> {
    if (!this.running) {
      return this.getStatus();
    }

    this.running = false;
    this.stats.elapsedSeconds = Math.round((Date.now() - this.startTime) / 1000);

    if (this.simIntervalTimer) {
      clearInterval(this.simIntervalTimer);
      this.simIntervalTimer = undefined;
    }
    if (this.requestIntervalTimer) {
      clearInterval(this.requestIntervalTimer);
      this.requestIntervalTimer = undefined;
    }
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = undefined;
    }

    // Disconnect simulated client sockets
    if (this.dispatcherSocket) {
      this.dispatcherSocket.removeAllListeners();
      if (this.dispatcherSocket.connected) {
        this.dispatcherSocket.disconnect();
      }
      this.dispatcherSocket = undefined;
    }

    for (const agent of this.driverAgents) {
      if (agent.socket) {
        agent.socket.removeAllListeners();
        if (agent.socket.connected) {
          agent.socket.disconnect();
        }
      }
      agent.status = 'available';
      agent.currentTrip = null;
    }

    try {
      const redisClient = this.redis.getClient();
      await redisClient.del('drivers:pending_offers');
      const driverIds = this.driverAgents.map((d) => d.id);
      if (driverIds.length > 0) {
        await this.prisma.driver.updateMany({
          where: { id: { in: driverIds } },
          data: {
            status: DriverStatus.AVAILABLE,
            activeRequestId: null,
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Could not reset drivers on stop: ${msg}`);
    }

    this.logger.log(
      `Simulator stopped after ${this.stats.elapsedSeconds}s. Requests: Created=${this.stats.requestsCreated}, Assigned=${this.stats.requestsAssigned}, Completed=${this.stats.requestsCompleted}, DoubleAssignments=${this.stats.doubleAssignmentsDetected}`,
    );

    return this.getStatus();
  }

  /**
   * Advances a driver along an array of road network waypoints by distanceCoveredKm.
   * Updates driver.lat, driver.lng, and driver.heading to match the exact road segment.
   * Returns the new waypointIndex.
   */
  private advanceAlongWaypoints(
    driver: SimDriverAgent,
    waypoints: Coordinates[],
    currentIndex: number,
    distanceCoveredKm: number,
  ): number {
    let index = currentIndex;
    let remainingDistance = distanceCoveredKm;

    while (index < waypoints.length - 1 && remainingDistance > 0) {
      const nextWp = waypoints[index + 1]!;

      const distToNext = haversineKm(
        { lat: driver.lat, lng: driver.lng },
        nextWp,
      );

      // Set heading to the road segment bearing
      driver.heading = calculateBearing(
        driver.lat,
        driver.lng,
        nextWp.lat,
        nextWp.lng,
      );

      if (distToNext <= remainingDistance) {
        // Snap to next waypoint and continue with remaining distance
        driver.lat = nextWp.lat;
        driver.lng = nextWp.lng;
        remainingDistance -= distToNext;
        index++;
      } else {
        // Advance partway along the segment
        const nextPos = movePosition(
          driver.lat,
          driver.lng,
          driver.heading,
          remainingDistance,
        );
        driver.lat = nextPos.lat;
        driver.lng = nextPos.lng;
        remainingDistance = 0;
      }
    }

    return index;
  }

  /**
   * Steps driver physics and movement forward by deltaTimeSeconds
   */
  stepMovement(deltaTimeSeconds: number): void {
    const distanceFactor = deltaTimeSeconds / 3600; // hours

    for (const driver of this.driverAgents) {
      const effectiveSpeedKmh = driver.speedKmh * this.config.speedMultiplier;
      const distanceCoveredKm = effectiveSpeedKmh * distanceFactor;

      if (driver.status === 'available') {
        // Road-network patrolling between Bengaluru hotspots
        if (
          !driver.routeWaypoints ||
          driver.waypointIndex === undefined ||
          driver.waypointIndex >= driver.routeWaypoints.length - 1
        ) {
          const dest = this.pickWeightedHotspot();
          driver.routeWaypoints = [
            { lat: driver.lat, lng: driver.lng },
            { lat: dest.lat, lng: dest.lng },
          ];
          driver.waypointIndex = 0;

          this.osrmService
            .getRoutePath(
              { lat: driver.lat, lng: driver.lng },
              { lat: dest.lat, lng: dest.lng },
            )
            .then((path) => {
              if (driver.status === 'available' && path.length > 1) {
                driver.routeWaypoints = path;
                driver.waypointIndex = 0;
              }
            })
            .catch(() => {});
        }

        if (driver.routeWaypoints && driver.routeWaypoints.length > 1) {
          driver.waypointIndex = this.advanceAlongWaypoints(
            driver,
            driver.routeWaypoints,
            driver.waypointIndex ?? 0,
            distanceCoveredKm,
          );
        } else {
          // Fallback drift within boundary
          driver.heading = (driver.heading + this.prng.range(-15, 15) + 360) % 360;
          const nextPos = movePosition(driver.lat, driver.lng, driver.heading, distanceCoveredKm);
          if (
            nextPos.lat < BENGALURU_BOUNDS.MIN_LAT ||
            nextPos.lat > BENGALURU_BOUNDS.MAX_LAT ||
            nextPos.lng < BENGALURU_BOUNDS.MIN_LNG ||
            nextPos.lng > BENGALURU_BOUNDS.MAX_LNG
          ) {
            driver.heading = (driver.heading + 180 + 360) % 360;
          } else {
            driver.lat = nextPos.lat;
            driver.lng = nextPos.lng;
          }
        }
      } else if (driver.status === 'busy' && driver.currentTrip) {
        // Driver is executing a delivery trip strictly following road network geometry
        const trip = driver.currentTrip;
        const target =
          trip.phase === 'to_pickup'
            ? { lat: trip.pickupLat, lng: trip.pickupLng }
            : { lat: trip.dropLat, lng: trip.dropLng };

        // Ensure road waypoints are loaded for the current trip phase
        if (!trip.waypoints || trip.waypoints.length <= 1) {
          trip.waypoints = [
            { lat: driver.lat, lng: driver.lng },
            { lat: target.lat, lng: target.lng },
          ];
          trip.waypointIndex = 0;

          this.osrmService
            .getRoutePath(
              { lat: driver.lat, lng: driver.lng },
              target,
            )
            .then((path) => {
              if (driver.currentTrip === trip && path.length > 1) {
                trip.waypoints = path;
                trip.waypointIndex = 0;
              }
            })
            .catch(() => {});
        }

        // Advance along road network waypoints
        trip.waypointIndex = this.advanceAlongWaypoints(
          driver,
          trip.waypoints,
          trip.waypointIndex ?? 0,
          distanceCoveredKm,
        );

        const distanceToTarget = haversineKm(
          { lat: driver.lat, lng: driver.lng },
          target,
        );

        if (
          trip.waypointIndex >= trip.waypoints.length - 1 ||
          distanceToTarget <= Math.max(0.05, distanceCoveredKm)
        ) {
          // Arrived at target!
          driver.lat = target.lat;
          driver.lng = target.lng;

          if (trip.phase === 'to_pickup') {
            // Picked up! Transition to dropoff phase
            trip.phase = 'to_dropoff';
            trip.waypoints = undefined;
            trip.waypointIndex = 0;

            // Pre-fetch road route to dropoff
            this.osrmService
              .getRoutePath(
                { lat: trip.pickupLat, lng: trip.pickupLng },
                { lat: trip.dropLat, lng: trip.dropLng },
              )
              .then((path) => {
                if (driver.currentTrip === trip && path.length > 1) {
                  trip.waypoints = path;
                  trip.waypointIndex = 0;
                }
              })
              .catch(() => {});

            this.prisma.deliveryRequest
              .update({
                where: { id: trip.requestId },
                data: { status: RequestStatus.PICKED_UP },
              })
              .catch((err: Error) => this.logger.debug(`Error updating pickup: ${err.message}`));
          } else {
            // Delivered! Complete the trip
            this.prisma.deliveryRequest
              .update({
                where: { id: trip.requestId },
                data: {
                  status: RequestStatus.DELIVERED,
                  completedAt: new Date(),
                },
              })
              .catch((err: Error) => this.logger.debug(`Error updating delivery: ${err.message}`));

            this.prisma.driver
              .update({
                where: { id: driver.id },
                data: {
                  status: DriverStatus.AVAILABLE,
                  activeRequestId: null,
                  dailyTrips: { increment: 1 },
                },
              })
              .catch((err: Error) => this.logger.debug(`Error releasing driver: ${err.message}`));

            driver.status = 'available';
            driver.currentTrip = null;
            driver.routeWaypoints = undefined;
            driver.waypointIndex = undefined;
            this.stats.requestsCompleted++;
          }
        }
      }

      driver.lastMovedAt = Date.now();

      // Send location update through the standard public API / service path
      this.driversService
        .updateLocation(driver.id, {
          lat: driver.lat,
          lng: driver.lng,
          heading: Math.round(driver.heading),
          speed: Math.round(effectiveSpeedKmh),
        })
        .catch((e) => this.logger.debug(`Location update failed: ${e.message}`));
    }
  }

  /**
   * Generates a realistic delivery request between two different Bengaluru hotspots
   */
  async stepRequestGeneration(): Promise<void> {
    const pickupHub = this.pickWeightedHotspot();
    let dropHub = this.pickWeightedHotspot();
    while (dropHub.name === pickupHub.name) {
      dropHub = this.pickWeightedHotspot();
    }

    // Add small random jitter (within ~500m) to hotspot centers
    const pickupLat = pickupHub.lat + this.prng.range(-0.005, 0.005);
    const pickupLng = pickupHub.lng + this.prng.range(-0.005, 0.005);
    const dropLat = dropHub.lat + this.prng.range(-0.005, 0.005);
    const dropLng = dropHub.lng + this.prng.range(-0.005, 0.005);

    try {
      const created = await this.requestsService.create({
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        priority: this.prng.intRange(1, 3),
      });

      this.stats.requestsCreated++;

      // Trigger offer cascade
      await this.offerCascadeService.startCascade(created.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to generate request: ${message}`);
    }
  }

  /**
   * Driver offer decision handler: accepts or rejects simulated offer
   */
  async handleSimDriverOffer(
    driverId: string,
    requestId: string,
    requestCoords: { pickupLat: number; pickupLng: number; dropLat: number; dropLng: number },
  ): Promise<void> {
    const driver = this.driverAgents.find((d) => d.id === driverId);
    if (!driver || driver.status !== 'available') {
      return;
    }

    const willAccept = this.prng.chance(this.config.acceptProbability);

    if (willAccept) {
      try {
        await this.offerCascadeService.acceptOffer(requestId, driverId);
        driver.status = 'busy';
        driver.currentTrip = {
          requestId,
          pickupLat: requestCoords.pickupLat,
          pickupLng: requestCoords.pickupLng,
          dropLat: requestCoords.dropLat,
          dropLng: requestCoords.dropLng,
          phase: 'to_pickup',
          waypoints: [
            { lat: driver.lat, lng: driver.lng },
            { lat: requestCoords.pickupLat, lng: requestCoords.pickupLng },
          ],
          waypointIndex: 0,
        };

        // Fetch turn-by-turn road network route to pickup
        this.osrmService
          .getRoutePath(
            { lat: driver.lat, lng: driver.lng },
            { lat: requestCoords.pickupLat, lng: requestCoords.pickupLng },
          )
          .then((path) => {
            if (driver.currentTrip && driver.currentTrip.phase === 'to_pickup' && path.length > 1) {
              driver.currentTrip.waypoints = path;
              driver.currentTrip.waypointIndex = 0;
            }
          })
          .catch(() => {});

        this.stats.requestsAssigned++;
        this.logger.log(`[SIM] Driver ${driverId} accepted request ${requestId}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Driver ${driverId} failed to accept ${requestId}: ${message}`);
      }
    } else {
      try {
        await this.offerCascadeService.rejectOffer(requestId, driverId, 'Driver simulated rejection');
        this.logger.log(`[SIM] Driver ${driverId} rejected request ${requestId}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Driver ${driverId} failed to reject ${requestId}: ${message}`);
      }
    }
  }

  private pickWeightedHotspot(): Hotspot {
    const totalWeight = BENGALURU_HOTSPOTS.reduce((sum, h) => sum + h.weight, 0);
    let rand = this.prng.range(0, totalWeight);
    for (const hotspot of BENGALURU_HOTSPOTS) {
      if (rand < hotspot.weight) {
        return hotspot;
      }
      rand -= hotspot.weight;
    }
    return BENGALURU_HOTSPOTS[0]!;
  }

  /**
   * Spawns or loads simulated drivers and initializes their Socket.IO clients
   */
  private async initializeDrivers(count: number): Promise<void> {
    this.driverAgents = [];

    // Query existing drivers in DB
    const existing = await this.prisma.driver.findMany({
      take: count,
    });

    const driversToUse = [...existing];

    // If fewer than count exist, create remaining
    if (driversToUse.length < count) {
      const needed = count - driversToUse.length;
      for (let i = 1; i <= needed; i++) {
        const hub = this.pickWeightedHotspot();
        const lat = hub.lat + this.prng.range(-0.01, 0.01);
        const lng = hub.lng + this.prng.range(-0.01, 0.01);
        const nameIdx = (driversToUse.length + i - 1) % REAL_DRIVER_NAMES.length;
        const driverName = REAL_DRIVER_NAMES[nameIdx]!;

        const newDriver = await this.prisma.driver.create({
          data: {
            name: driverName,
            phone: `+91990000${(1000 + driversToUse.length + i).toString()}`,
            status: DriverStatus.AVAILABLE,
            rating: Math.round(this.prng.range(4.2, 5.0) * 10) / 10,
            lat,
            lng,
          },
        });
        driversToUse.push(newDriver);
      }
    }

    // Upgrade any legacy 'Sim Driver #' names in DB to realistic names
    for (let i = 0; i < driversToUse.length; i++) {
      const d = driversToUse[i]!;
      if (d.name.startsWith('Sim Driver')) {
        const realName = REAL_DRIVER_NAMES[i % REAL_DRIVER_NAMES.length]!;
        await this.prisma.driver.update({
          where: { id: d.id },
          data: { name: realName },
        });
        d.name = realName;
      }
    }

    const selectedDrivers = driversToUse.slice(0, count);
    const driverIds = selectedDrivers.map((d) => d.id);

    // Reset status to AVAILABLE in PostgreSQL
    await this.prisma.driver.updateMany({
      where: { id: { in: driverIds } },
      data: {
        status: DriverStatus.AVAILABLE,
        activeRequestId: null,
      },
    });

    const redisClient = this.redis.getClient();
    await redisClient.del('drivers:pending_offers');
    await Promise.all(
      selectedDrivers.map(async (d) => {
        await redisClient.del(`driver:active_offer:${d.id}`);
        await this.driversService.updateLocation(d.id, {
          lat: d.lat,
          lng: d.lng,
        });
      }),
    );

    const jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'fleetpulse-dev-jwt-access-secret-minimum-32-chars-long';
    const port = this.configService.get<number>('PORT') || 4000;
    const socketUrl = this.config.socketUrl || `http://127.0.0.1:${port}`;

    // Connect dispatcher socket to track real-time expired and cancelled events
    try {
      const dispatcherToken = jwt.sign(
        { sub: 'sim-dispatcher', role: 'dispatcher' },
        jwtSecret,
      );
      this.dispatcherSocket = io(socketUrl, {
        transports: ['websocket'],
        auth: { token: dispatcherToken },
        reconnection: false,
      });
      this.dispatcherSocket.on('request:expired', () => {
        this.stats.requestsExpired++;
      });
      this.dispatcherSocket.on('request:cancelled', () => {
        this.stats.requestsCancelled++;
      });
      this.dispatcherSocket.connect();
    } catch (dispErr: unknown) {
      const msg = dispErr instanceof Error ? dispErr.message : String(dispErr);
      this.logger.debug(`Dispatcher socket setup skipped: ${msg}`);
    }

    for (const d of selectedDrivers) {
      const heading = this.prng.range(0, 360);
      const speedKmh = this.prng.range(25, 45);

      const agent: SimDriverAgent = {
        id: d.id,
        name: d.name,
        phone: d.phone,
        lat: d.lat,
        lng: d.lng,
        heading,
        speedKmh,
        status: 'available',
        currentTrip: null,
        lastMovedAt: Date.now(),
      };

      // Connect Socket.IO client if socketUrl is accessible
      try {
        const token = jwt.sign(
          { sub: d.id, role: 'driver', driverId: d.id },
          jwtSecret,
        );

        const socket = io(socketUrl, {
          transports: ['websocket'],
          auth: { token },
          reconnection: false,
          autoConnect: false,
        });

        socket.on('request:offered', (offer: {
          requestId: string;
          driverId: string;
          pickupLat?: number;
          pickupLng?: number;
          dropLat?: number;
          dropLng?: number;
        }) => {
          if (offer.driverId === agent.id) {
            const delay = Math.round(this.prng.range(500, 2000) / this.config.speedMultiplier);
            setTimeout(() => {
              this.handleSimDriverOffer(agent.id, offer.requestId, {
                pickupLat: offer.pickupLat ?? agent.lat,
                pickupLng: offer.pickupLng ?? agent.lng,
                dropLat: offer.dropLat ?? agent.lat + 0.02,
                dropLng: offer.dropLng ?? agent.lng + 0.02,
              }).catch((e) => this.logger.debug(`Sim driver offer error: ${e.message}`));
            }, delay);
          }
        });

        socket.connect();
        agent.socket = socket;
      } catch (socketErr: unknown) {
        const msg = socketErr instanceof Error ? socketErr.message : String(socketErr);
        this.logger.debug(`Socket connection skipped for sim driver ${d.id}: ${msg}`);
      }

      this.driverAgents.push(agent);
    }

    // Wait for driver sockets to establish connection and join rooms
    const connectPromises = this.driverAgents
      .filter((a) => a.socket)
      .map(
        (a) =>
          new Promise<void>((resolve) => {
            if (a.socket?.connected) {
              resolve();
              return;
            }
            const timeout = setTimeout(() => resolve(), 5000);
            a.socket?.once('connect', () => {
              clearTimeout(timeout);
              resolve();
            });
            a.socket?.once('connect_error', () => {
              clearTimeout(timeout);
              resolve();
            });
          }),
      );

    await Promise.all(connectPromises);

    this.logger.log(
      `Initialized ${this.driverAgents.length} simulated driver agents (all connected).`,
    );
  }
}
