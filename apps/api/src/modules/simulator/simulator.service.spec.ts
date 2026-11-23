import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SimulatorService } from './simulator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DriversService } from '../drivers/drivers.service';
import { RequestsService } from '../requests/requests.service';
import { OfferCascadeService } from '../realtime/cascade/offer-cascade.service';
import { OsrmService } from '../analytics/osrm.service';
import { DriverStatus, RequestStatus } from '@fleet-pulse/shared';

describe('SimulatorService (Unit)', () => {
  let service: SimulatorService;
  let mockPrisma: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockRedis: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockDriversService: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockRequestsService: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockOfferCascadeService: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(async () => {
    mockRedis = {
      getClient: () => ({
        del: jest.fn().mockResolvedValue(1),
        sadd: jest.fn().mockResolvedValue(1),
        srem: jest.fn().mockResolvedValue(1),
        smembers: jest.fn().mockResolvedValue([]),
      }),
    };
    mockPrisma = {
      driver: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sim-d-1',
            name: 'Sim Driver 1',
            phone: '+91990011001',
            status: DriverStatus.AVAILABLE,
            rating: 4.8,
            lat: 12.9716,
            lng: 77.5946,
            dailyTrips: 0,
          },
          {
            id: 'sim-d-2',
            name: 'Sim Driver 2',
            phone: '+91990011002',
            status: DriverStatus.AVAILABLE,
            rating: 4.9,
            lat: 12.9352,
            lng: 77.6245,
            dailyTrips: 0,
          },
        ]),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'gen-' + Math.random().toString(36).substring(7),
          ...data,
        })),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      deliveryRequest: {
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      dispatchEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };

    mockDriversService = {
      updateLocation: jest.fn().mockResolvedValue({ status: 'acknowledged' }),
    };

    mockRequestsService = {
      create: jest.fn().mockResolvedValue({
        id: 'sim-req-1',
        pickupLat: 12.9352,
        pickupLng: 77.6245,
        dropLat: 12.9784,
        dropLng: 77.6408,
        status: RequestStatus.PENDING,
        priority: 1,
      }),
    };

    mockOfferCascadeService = {
      startCascade: jest.fn().mockResolvedValue(true),
      acceptOffer: jest.fn().mockResolvedValue(true),
      rejectOffer: jest.fn().mockResolvedValue(true),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: unknown) => {
        if (key === 'JWT_SECRET') return 'test-jwt-secret-min-32-chars-long-here';
        if (key === 'PORT') return 4000;
        return defaultVal;
      }),
    };

    const mockOsrmService = {
      getRoutePath: jest.fn().mockResolvedValue([
        { lat: 12.9716, lng: 77.5946 },
        { lat: 12.96, lng: 77.6 },
        { lat: 12.9352, lng: 77.6245 },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulatorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: DriversService, useValue: mockDriversService },
        { provide: RequestsService, useValue: mockRequestsService },
        { provide: OfferCascadeService, useValue: mockOfferCascadeService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OsrmService, useValue: mockOsrmService },
      ],
    }).compile();

    service = module.get<SimulatorService>(SimulatorService);
  });

  afterEach(async () => {
    await service.stop();
  });

  it('initializes simulator with default config and starts driver agents', async () => {
    const stats = await service.start({
      driverCount: 2,
      speedMultiplier: 5,
      requestRatePerMinute: 60,
      acceptProbability: 1.0,
      seed: 42,
    });

    expect(stats.running).toBe(true);
    expect(stats.driverCount).toBe(2);
    expect(stats.speedMultiplier).toBe(5);
    expect(stats.doubleAssignmentsDetected).toBe(0);
  });

  it('steps driver movement and updates locations within Bengaluru bounds', async () => {
    await service.start({
      driverCount: 2,
      speedMultiplier: 1,
      requestRatePerMinute: 0, // no requests for this movement test
      seed: 1234,
    });

    // Step movement for 5 seconds
    service.stepMovement(5);

    expect(mockDriversService.updateLocation).toHaveBeenCalled();
    const stats = service.getStatus();
    expect(stats.doubleAssignmentsDetected).toBe(0);
  });

  it('generates simulated delivery requests at hotspots', async () => {
    await service.start({
      driverCount: 2,
      speedMultiplier: 10,
      requestRatePerMinute: 120, // 2 per second
      seed: 99,
    });

    await service.stepRequestGeneration();

    expect(mockRequestsService.create).toHaveBeenCalled();
    expect(mockOfferCascadeService.startCascade).toHaveBeenCalled();

    const stats = service.getStatus();
    expect(stats.requestsCreated).toBeGreaterThan(0);
  });

  it('handles driver offer decisions: accepts when probability is 1.0', async () => {
    await service.start({
      driverCount: 2,
      speedMultiplier: 10,
      acceptProbability: 1.0, // Guaranteed accept
      seed: 777,
    });

    const drivers = service.getDrivers();
    const driver1 = drivers[0];
    expect(driver1).toBeDefined();

    await service.handleSimDriverOffer(driver1!.id, 'sim-req-100', {
      pickupLat: 12.9352,
      pickupLng: 77.6245,
      dropLat: 12.9784,
      dropLng: 77.6408,
    });

    expect(mockOfferCascadeService.acceptOffer).toHaveBeenCalledWith('sim-req-100', driver1!.id);
    expect(driver1!.status).toBe('busy');
    expect(driver1!.currentTrip).toBeDefined();
    expect(driver1!.currentTrip!.phase).toBe('to_pickup');
  });

  it('handles driver offer decisions: rejects when probability is 0.0', async () => {
    await service.start({
      driverCount: 2,
      speedMultiplier: 10,
      acceptProbability: 0.0, // Guaranteed reject
      seed: 888,
    });

    const drivers = service.getDrivers();
    const driver2 = drivers[1];
    expect(driver2).toBeDefined();

    await service.handleSimDriverOffer(driver2!.id, 'sim-req-200', {
      pickupLat: 12.9352,
      pickupLng: 77.6245,
      dropLat: 12.9784,
      dropLng: 77.6408,
    });

    expect(mockOfferCascadeService.rejectOffer).toHaveBeenCalledWith(
      'sim-req-200',
      driver2!.id,
      expect.any(String),
    );
    expect(driver2!.status).toBe('available');
    expect(driver2!.currentTrip).toBeNull();
  });

  it('advances trip phase from to_pickup to to_dropoff and then delivers', async () => {
    await service.start({
      driverCount: 1,
      speedMultiplier: 20,
      acceptProbability: 1.0,
      seed: 1,
    });

    const drivers = service.getDrivers();
    const driver = drivers[0]!;

    // Set driver on trip right at pickup
    driver.status = 'busy';
    driver.lat = 12.9352;
    driver.lng = 77.6245;
    driver.currentTrip = {
      requestId: 'trip-1',
      pickupLat: 12.9352,
      pickupLng: 77.6245,
      dropLat: 12.9360,
      dropLng: 77.6250,
      phase: 'to_pickup',
    };

    // Step movement: should pick up
    service.stepMovement(1);
    expect(driver.currentTrip.phase).toBe('to_dropoff');

    // Move driver to dropoff
    driver.lat = 12.9360;
    driver.lng = 77.6250;

    // Step movement: should complete and deliver
    service.stepMovement(1);
    expect(driver.status).toBe('available');
    expect(driver.currentTrip).toBeNull();

    const stats = service.getStatus();
    expect(stats.requestsCompleted).toBe(1);
    expect(stats.doubleAssignmentsDetected).toBe(0);
  });
});
