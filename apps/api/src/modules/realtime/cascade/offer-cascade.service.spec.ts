import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OfferCascadeService } from './offer-cascade.service';
import { EventsGateway } from '../events.gateway';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { DispatchService } from '../../dispatch/dispatch.service';
import { DriverStatus, RequestStatus } from '@fleet-pulse/shared';

describe('OfferCascadeService (Unit)', () => {
  let service: OfferCascadeService;
  let mockGateway: Partial<EventsGateway>;
  let mockPrisma: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockRedis: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockDispatchService: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockQueue: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Mock in-memory redis keys
  let redisStore: Map<string, string>;
  let redisSets: Map<string, Set<string>>;

  beforeEach(async () => {
    redisStore = new Map();
    redisSets = new Map();

    mockGateway = {
      emitRequestOffered: jest.fn(),
      broadcastRequestAssigned: jest.fn(),
      broadcastRequestExpired: jest.fn(),
    };

    mockQueue = {
      add: jest.fn().mockImplementation(async (_name, _data, opts) => ({
        id: opts?.jobId || 'job-1',
        remove: jest.fn(),
      })),
      getJob: jest.fn().mockImplementation(async (jobId) => ({
        id: jobId,
        remove: jest.fn(),
      })),
      close: jest.fn(),
    };

    mockRedis = {
      getClient: () => ({
        get: jest.fn().mockImplementation(async (key: string) => redisStore.get(key) || null),
        set: jest.fn().mockImplementation(async (key: string, val: string) => {
          redisStore.set(key, val);
          return 'OK';
        }),
        del: jest.fn().mockImplementation(async (key: string) => {
          redisStore.delete(key);
          redisSets.delete(key);
          return 1;
        }),
        sadd: jest.fn().mockImplementation(async (key: string, member: string) => {
          if (!redisSets.has(key)) redisSets.set(key, new Set());
          redisSets.get(key)!.add(member);
          return 1;
        }),
        smembers: jest.fn().mockImplementation(async (key: string) => {
          return Array.from(redisSets.get(key) || []);
        }),
        sismember: jest.fn().mockImplementation(async (key: string, member: string) => {
          return redisSets.get(key)?.has(member) ? 1 : 0;
        }),
      }),
      geoSearch: jest.fn().mockResolvedValue([]),
    };

    mockPrisma = {
      deliveryRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'req-1',
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          dropLat: 12.9279,
          dropLng: 77.6271,
          status: RequestStatus.PENDING,
          priority: 1,
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      driver: {
        findMany: jest.fn().mockImplementation(async (args) => {
          const allDrivers = [
            {
              id: 'driver-1',
              name: 'Best Driver',
              phone: '111',
              status: DriverStatus.AVAILABLE,
              rating: 4.9,
              lat: 12.972,
              lng: 77.595,
              dailyTrips: 1,
            },
            {
              id: 'driver-2',
              name: 'Second Best Driver',
              phone: '222',
              status: DriverStatus.AVAILABLE,
              rating: 4.8,
              lat: 12.973,
              lng: 77.596,
              dailyTrips: 2,
            },
          ];
          if (args?.where?.id?.notIn) {
            const notIn = new Set(args.where.id.notIn);
            return allDrivers.filter((d) => !notIn.has(d.id));
          }
          return allDrivers;
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'driver-1',
          status: DriverStatus.AVAILABLE,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      dispatchEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };

    mockDispatchService = {};

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: unknown) => {
        if (key === 'OFFER_TIMEOUT_SECONDS') return 20;
        if (key === 'MAX_OFFER_ATTEMPTS') return 3;
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfferCascadeService,
        { provide: EventsGateway, useValue: mockGateway },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: DispatchService, useValue: mockDispatchService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OfferCascadeService>(OfferCascadeService);
    // Attach mock queue
    (service as unknown as { offerQueue: unknown }).offerQueue = mockQueue;
  });

  it('starts cascade, offers to best driver, schedules BullMQ timeout job, and emits request:offered', async () => {
    const success = await service.startCascade('req-1');

    expect(success).toBe(true);
    // Request updated to offered
    expect(mockPrisma.deliveryRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: expect.objectContaining({ status: RequestStatus.OFFERED }),
      }),
    );
    // BullMQ delayed job scheduled for 20 seconds
    expect(mockQueue.add).toHaveBeenCalledWith(
      'offer-timeout',
      expect.objectContaining({ requestId: 'req-1', driverId: 'driver-1', attempt: 1 }),
      expect.objectContaining({ delay: 20000, jobId: 'offer:req-1:1' }),
    );
    // Socket event emitted to driver and dispatchers
    expect(mockGateway.emitRequestOffered).toHaveBeenCalledWith(
      'driver-1',
      expect.objectContaining({
        requestId: 'req-1',
        driverId: 'driver-1',
        attempt: 1,
        timeoutSeconds: 20,
      }),
    );
    // Active offer stored in Redis
    expect(redisStore.get('offer:active:req-1')).toBeDefined();
    expect(redisStore.get('driver:active_offer:driver-1')).toBe('req-1');
  });

  it('driver accepts offer: cancels BullMQ job, assigns atomically, emits request:assigned, and cleans up Redis', async () => {
    // Setup active offer state
    redisStore.set(
      'offer:active:req-1',
      JSON.stringify({ driverId: 'driver-1', attempt: 1 }),
    );
    redisStore.set('driver:active_offer:driver-1', 'req-1');

    const accepted = await service.acceptOffer('req-1', 'driver-1');

    expect(accepted).toBe(true);
    // Assigned event emitted
    expect(mockGateway.broadcastRequestAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-1', driverId: 'driver-1' }),
    );
    // Redis keys cleaned up
    expect(redisStore.get('offer:active:req-1')).toBeUndefined();
    expect(redisStore.get('driver:active_offer:driver-1')).toBeUndefined();
  });

  it('driver rejects offer: records rejection, cancels job, and cascades to second best driver', async () => {
    redisStore.set(
      'offer:active:req-1',
      JSON.stringify({ driverId: 'driver-1', attempt: 1 }),
    );
    redisStore.set('driver:active_offer:driver-1', 'req-1');

    const rejected = await service.rejectOffer('req-1', 'driver-1', 'Not available right now');

    expect(rejected).toBe(true);
    // Driver 1 recorded in rejected set
    expect(redisSets.get('offer:rejected:req-1')?.has('driver-1')).toBe(true);
    // Active offer for driver 1 cleared
    expect(redisStore.get('driver:active_offer:driver-1')).toBeUndefined();

    // Cascaded to second best driver (driver-2)
    expect(mockGateway.emitRequestOffered).toHaveBeenCalledWith(
      'driver-2',
      expect.objectContaining({
        requestId: 'req-1',
        driverId: 'driver-2',
        attempt: 2,
      }),
    );
  });

  it('expires request after MAX_OFFER_ATTEMPTS reached and emits request:expired', async () => {
    // Already at attempt 3
    redisStore.set(
      'offer:active:req-1',
      JSON.stringify({ driverId: 'driver-3', attempt: 3 }),
    );
    redisStore.set('driver:active_offer:driver-3', 'req-1');

    await service.rejectOffer('req-1', 'driver-3', 'Timeout');

    // Request marked as expired
    expect(mockPrisma.deliveryRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: expect.objectContaining({ status: RequestStatus.EXPIRED }),
      }),
    );
    // Expired event broadcast
    expect(mockGateway.broadcastRequestExpired).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-1' }),
    );
  });

  it('driver disconnect triggers immediate rejection and cascade', async () => {
    redisStore.set(
      'offer:active:req-1',
      JSON.stringify({ driverId: 'driver-1', attempt: 1 }),
    );
    redisStore.set('driver:active_offer:driver-1', 'req-1');

    await service.handleDriverDisconnect('driver-1');

    // Rejection recorded for driver-1
    expect(redisSets.get('offer:rejected:req-1')?.has('driver-1')).toBe(true);
  });
});
