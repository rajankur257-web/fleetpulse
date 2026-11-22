import { Test, TestingModule } from '@nestjs/testing';
import {
  DriverStatus,
  RequestStatus,
} from '@fleet-pulse/shared';
import { DispatchService } from './dispatch.service';
import { StrategyRegistry } from './strategies/strategy.registry';
import { NearestDriverStrategy } from './strategies/nearest-driver.strategy';
import { ScoredStrategy } from './strategies/scored.strategy';
import { BatchStrategy } from './strategies/batch.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

interface MockDriver {
  id: string;
  name: string;
  phone: string;
  status: DriverStatus;
  rating: number;
  lat: number;
  lng: number;
  dailyTrips: number;
  lastLocationAt: Date;
  activeRequestId: string | null;
}

interface MockRequest {
  id: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  status: RequestStatus;
  priority: number;
  assignedDriverId?: string;
  assignedAt?: Date;
}

interface MockEvent {
  id?: string;
  requestId?: string;
  driverId?: string;
  type: string;
  payload: Record<string, unknown>;
}

describe('DispatchService & Atomic Concurrency', () => {
  let service: DispatchService;

  // Mock in-memory state for drivers and requests
  let driversDb: Map<string, MockDriver>;
  let requestsDb: Map<string, MockRequest>;
  let redisLocks: Set<string>;
  let eventsDb: MockEvent[];

  beforeEach(async () => {
    driversDb = new Map();
    requestsDb = new Map();
    redisLocks = new Set();
    eventsDb = [];

    // Initialize 10 available drivers
    for (let i = 1; i <= 10; i++) {
      const id = `driver-${i}`;
      driversDb.set(id, {
        id,
        name: `Driver ${i}`,
        phone: `+91990000000${i}`,
        status: DriverStatus.AVAILABLE,
        rating: 4.5 + (i % 5) * 0.1,
        lat: 12.9716 + (i * 0.001),
        lng: 77.5946 + (i * 0.001),
        dailyTrips: i,
        lastLocationAt: new Date(),
        activeRequestId: null,
      });
    }

    const mockPrisma = {
      driver: {
        findMany: jest.fn().mockImplementation(async (args) => {
          let list = Array.from(driversDb.values());
          if (args?.where?.status) {
            list = list.filter((d) => d.status === args.where.status);
          }
          return list;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return driversDb.get(where.id) || null;
        }),
        // Atomic conditional update simulation: WHERE id = :id AND status = 'available'
        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          const driver = driversDb.get(where.id);
          if (driver && (!where.status || driver.status === where.status)) {
            Object.assign(driver, data);
            return { count: 1 };
          }
          return { count: 0 };
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const driver = driversDb.get(where.id);
          if (driver) {
            Object.assign(driver, data);
          }
          return driver;
        }),
      },
      deliveryRequest: {
        findMany: jest.fn().mockImplementation(async (args) => {
          let list = Array.from(requestsDb.values());
          if (args?.where?.status) {
            list = list.filter((r) => r.status === args.where.status);
          }
          return list;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return requestsDb.get(where.id) || null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const req = requestsDb.get(where.id);
          if (req) {
            Object.assign(req, data);
          }
          return req;
        }),
        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          const req = requestsDb.get(where.id);
          if (req && (!where.status || (Array.isArray(where.status?.in) ? where.status.in.includes(req.status) : req.status === where.status))) {
            Object.assign(req, data);
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
      dispatchEvent: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          eventsDb.push(data);
          return { id: 'evt-' + eventsDb.length, ...data };
        }),
      },
    };

    const mockRedis = {
      getClient: () => ({
        // Simulated atomic SET NX PX
        set: jest.fn().mockImplementation(async (key: string, _val: string, _nx: string, _px: string, _ttl: number) => {
          if (redisLocks.has(key)) {
            return null; // Lock failed
          }
          redisLocks.add(key);
          return 'OK';
        }),
        eval: jest.fn().mockImplementation(async (_script: string, _numKeys: number, key: string, _val: string) => {
          redisLocks.delete(key);
          return 1;
        }),
        del: jest.fn().mockImplementation(async (key: string) => {
          redisLocks.delete(key);
          return 1;
        }),
      }),
      geoSearch: jest.fn().mockImplementation(async () => {
        return Array.from(driversDb.values())
          .filter((d) => d.status === DriverStatus.AVAILABLE)
          .map((d) => ({
            id: d.id,
            distanceKm: 1.0,
            lat: d.lat,
            lng: d.lng,
          }));
      }),
    };

    const nearestStrategy = new NearestDriverStrategy();
    const scoredStrategy = new ScoredStrategy();
    const batchStrategy = new BatchStrategy();
    const mockRegistry = new StrategyRegistry(
      nearestStrategy,
      scoredStrategy,
      batchStrategy,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: StrategyRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
  });

  it('matches and atomically assigns a single request', async () => {
    const req = {
      id: 'req-single',
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      dropLat: 12.9279,
      dropLng: 77.6271,
      status: RequestStatus.PENDING,
      priority: 1,
    };
    requestsDb.set(req.id, req);

    const result = await service.matchRequest(req.id);
    expect(result).not.toBeNull();
    expect(result!.requestId).toBe('req-single');

    // Verify driver status updated to busy
    const assignedDriver = driversDb.get(result!.driverId);
    expect(assignedDriver).toBeDefined();
    expect(assignedDriver!.status).toBe(DriverStatus.BUSY);
    expect(assignedDriver!.activeRequestId).toBe('req-single');

    // Verify request updated to assigned
    expect(req.status).toBe(RequestStatus.ASSIGNED);

    // Verify dispatch event recorded
    expect(eventsDb).toHaveLength(1);
    expect(eventsDb[0]!.type).toBe('request:assigned');
  });

  it('CONCURRENCY TEST: 100 simultaneous requests fired at 10 drivers guarantees zero double assignments', async () => {
    // Populate 100 pending delivery requests
    const requestIds: string[] = [];
    for (let i = 1; i <= 100; i++) {
      const id = `req-stress-${i}`;
      requestIds.push(id);
      requestsDb.set(id, {
        id,
        pickupLat: 12.9716 + (Math.random() - 0.5) * 0.05,
        pickupLng: 77.5946 + (Math.random() - 0.5) * 0.05,
        dropLat: 12.9279,
        dropLng: 77.6271,
        status: RequestStatus.PENDING,
        priority: 1,
      });
    }

    // Fire 100 concurrent requests simultaneously
    const results = await Promise.all(
      requestIds.map((id) => service.matchRequest(id)),
    );

    // Filter successful assignments
    const successfulAssignments = results.filter((r) => r !== null);

    // With 10 available drivers, exactly 10 requests should be successfully assigned
    expect(successfulAssignments.length).toBe(10);

    // Verify zero double assignments: every assigned driver ID must be unique
    const assignedDriverIds = successfulAssignments.map((a) => a!.driverId);
    const uniqueAssignedDriverIds = new Set(assignedDriverIds);
    expect(uniqueAssignedDriverIds.size).toBe(10);
    expect(assignedDriverIds.length).toBe(10);

    // Verify driver states: exactly 10 drivers busy, 0 double assigned
    let busyCount = 0;
    for (const driver of driversDb.values()) {
      if (driver.status === DriverStatus.BUSY) {
        busyCount++;
        expect(driver.activeRequestId).not.toBeNull();
      }
    }
    expect(busyCount).toBe(10);

    // Exactly 90 requests remain pending/unassigned
    const unassignedRequests = Array.from(requestsDb.values()).filter(
      (r) => r.status === RequestStatus.PENDING,
    );
    expect(unassignedRequests.length).toBe(90);
  });
});
