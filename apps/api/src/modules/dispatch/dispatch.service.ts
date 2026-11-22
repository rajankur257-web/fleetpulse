import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  Assignment,
  DeliveryRequest,
  DispatchContext,
  DispatchEventType,
  DispatchStrategyType,
  Driver,
  DriverStatus,
  RequestStatus,
} from '@fleet-pulse/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { StrategyRegistry } from './strategies/strategy.registry';
import { BatchStrategy } from './strategies/batch.strategy';
import crypto from 'crypto';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private static readonly LOCK_TTL_MS = 5000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly registry: StrategyRegistry,
  ) {}

  /**
   * Matches and assigns a single delivery request to the best available driver
   */
  async matchRequest(
    requestId: string,
    strategyOverride?: DispatchStrategyType,
    context?: DispatchContext,
  ): Promise<Assignment | null> {
    const request = await this.prisma.deliveryRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Delivery request with ID ${requestId} not found`);
    }

    if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.OFFERED) {
      throw new BadRequestException(
        `Cannot dispatch request with status '${request.status}'. Must be pending or offered.`,
      );
    }

    // 1. Gather candidate drivers (querying Redis GEO + PostgreSQL fallback)
    const candidates = await this.fetchCandidateDrivers(
      request.pickupLat,
      request.pickupLng,
      50, // 50 km radius search
    );

    if (candidates.length === 0) {
      this.logger.warn(`No available candidates found for request ${requestId}`);
      return null;
    }

    // 2. Select strategy
    const strategy = strategyOverride
      ? this.registry.get(strategyOverride)
      : this.registry.getActiveStrategy();

    const dispatchContext: DispatchContext = {
      activeStrategy: strategy.name,
      ...context,
    };

    // 3. Clone candidates array so we can attempt next candidate if concurrency lock fails
    let remainingCandidates = [...candidates];

    while (remainingCandidates.length > 0) {
      const assignment = strategy.assign(
        request as unknown as DeliveryRequest,
        remainingCandidates,
        dispatchContext,
      );

      if (!assignment) {
        return null;
      }

      // 4. Attempt atomic assignment with Redis distributed lock + conditional SQL UPDATE
      const success = await this.executeAtomicAssignment(
        assignment.requestId,
        assignment.driverId,
        assignment,
      );

      if (success) {
        return assignment;
      }

      // Concurrency conflict occurred: remove this candidate and try next
      remainingCandidates = remainingCandidates.filter(
        (c) => c.id !== assignment.driverId,
      );
    }

    return null;
  }

  /**
   * Runs batch dispatch across pending requests and available drivers
   */
  async batchMatch(
    requestIds?: string[],
    strategyOverride?: DispatchStrategyType,
  ): Promise<Assignment[]> {
    // 1. Query pending delivery requests
    const whereClause: Prisma.DeliveryRequestWhereInput = {
      status: RequestStatus.PENDING,
    };
    if (requestIds && requestIds.length > 0) {
      whereClause.id = { in: requestIds };
    }

    const requests = await this.prisma.deliveryRequest.findMany({
      where: whereClause,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (requests.length === 0) {
      return [];
    }

    // 2. Query available drivers
    const availableDrivers = await this.prisma.driver.findMany({
      where: { status: DriverStatus.AVAILABLE },
    });

    if (availableDrivers.length === 0) {
      return [];
    }

    const strategyType = strategyOverride ?? this.registry.getActiveStrategyType();
    const strategy = this.registry.get(strategyType);

    let candidateAssignments: Assignment[] = [];

    if (strategyType === DispatchStrategyType.BATCH && strategy instanceof BatchStrategy) {
      candidateAssignments = strategy.assignBatch(
        requests as unknown as DeliveryRequest[],
        availableDrivers as unknown as Driver[],
      );
    } else {
      // Run sequential assign per request
      let pool = [...availableDrivers] as unknown as Driver[];
      for (const req of requests) {
        const assignment = strategy.assign(
          req as unknown as DeliveryRequest,
          pool,
        );
        if (assignment) {
          candidateAssignments.push(assignment);
          pool = pool.filter((d) => d.id !== assignment.driverId);
        }
      }
    }

    // 3. Atomically apply assignments
    const successfulAssignments: Assignment[] = [];

    for (const assignment of candidateAssignments) {
      const success = await this.executeAtomicAssignment(
        assignment.requestId,
        assignment.driverId,
        assignment,
      );
      if (success) {
        successfulAssignments.push(assignment);
      }
    }

    return successfulAssignments;
  }

  /**
   * Atomically assigns a driver to a request using Redis lock + conditional SQL
   */
  private async executeAtomicAssignment(
    requestId: string,
    driverId: string,
    assignment: Assignment,
  ): Promise<boolean> {
    const lockKey = `lock:driver:${driverId}`;
    const lockValue = crypto.randomUUID();
    const redisClient = this.redis.getClient();

    // 1. Acquire Redis lock with TTL
    let lockAcquired = false;
    try {
      const res = await redisClient.set(
        lockKey,
        lockValue,
        'PX',
        DispatchService.LOCK_TTL_MS,
        'NX',
      );
      lockAcquired = res === 'OK';
    } catch (err) {
      this.logger.warn(`Redis lock check failed for ${lockKey}: ${err}`);
      // Fallback: conditional SQL will still enforce atomicity
      lockAcquired = true;
    }

    if (!lockAcquired) {
      this.logger.debug(`Driver ${driverId} lock acquisition failed (already locked)`);
      return false;
    }

    try {
      // 2. Conditional SQL UPDATE: only update if status is still 'available'
      const driverUpdate = await this.prisma.driver.updateMany({
        where: {
          id: driverId,
          status: DriverStatus.AVAILABLE,
        },
        data: {
          status: DriverStatus.BUSY,
          activeRequestId: requestId,
        },
      });

      if (driverUpdate.count === 0) {
        // Driver was taken concurrently
        this.logger.debug(`Driver ${driverId} was already claimed concurrently`);
        return false;
      }

      // 3. Update DeliveryRequest to ASSIGNED
      const requestUpdate = await this.prisma.deliveryRequest.updateMany({
        where: {
          id: requestId,
          status: { in: [RequestStatus.PENDING, RequestStatus.OFFERED] },
        },
        data: {
          status: RequestStatus.ASSIGNED,
          assignedDriverId: driverId,
          assignedAt: new Date(),
        },
      });

      if (requestUpdate.count === 0) {
        // Request was cancelled or modified concurrently: revert driver status
        await this.prisma.driver.update({
          where: { id: driverId },
          data: {
            status: DriverStatus.AVAILABLE,
            activeRequestId: null,
          },
        });
        return false;
      }

      // 4. Record DispatchEvent audit log
      await this.prisma.dispatchEvent.create({
        data: {
          requestId,
          driverId,
          type: DispatchEventType.REQUEST_ASSIGNED,
          payload: {
            strategy: assignment.strategy,
            distanceKm: assignment.distanceKm,
            score: assignment.score ?? null,
            assignedAt: assignment.assignedAt,
          },
        },
      });

      this.logger.log(
        `Successfully assigned request ${requestId} to driver ${driverId} via ${assignment.strategy} (${assignment.distanceKm.toFixed(2)} km)`,
      );

      return true;
    } finally {
      // 5. Safely release Redis lock using Lua script verifying token
      try {
        const releaseScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await redisClient.eval(releaseScript, 1, lockKey, lockValue);
      } catch (unlockErr) {
        this.logger.error(`Error releasing Redis lock for ${lockKey}: ${unlockErr}`);
      }
    }
  }

  /**
   * Gathers candidates from Redis GEO and database
   */
  private async fetchCandidateDrivers(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Driver[]> {
    try {
      // Query Redis GEO for nearby drivers
      const nearbyGeo = await this.redis.geoSearch('drivers:geo', lng, lat, radiusKm);
      const geoDriverIds = nearbyGeo.map((d) => d.id);

      if (geoDriverIds.length > 0) {
        const drivers = await this.prisma.driver.findMany({
          where: {
            id: { in: geoDriverIds },
            status: DriverStatus.AVAILABLE,
          },
        });
        if (drivers.length > 0) {
          return drivers as unknown as Driver[];
        }
      }
    } catch (geoErr) {
      this.logger.warn(`Redis GEO candidate fetch failed: ${geoErr}`);
    }

    // Fallback: query database for available drivers
    const dbDrivers = await this.prisma.driver.findMany({
      where: { status: DriverStatus.AVAILABLE },
      take: 100,
    });

    return dbDrivers as unknown as Driver[];
  }
}
