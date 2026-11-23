import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DriversService } from './drivers.service';

describe('DriversService Anti-Spoofing & Geofence Protection (M10)', () => {
  let service: DriversService;

  const mockRedis = {
    geoAdd: jest.fn(async () => 1),
    geoRadius: jest.fn(async () => []),
  };

  const mockPrisma = {
    driver: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: RedisService, useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DriversService>(DriversService);
  });

  it('accepts initial location update and realistic movements', async () => {
    const driverId = 'driver-geo-1';

    // 1. Initial point in Koramangala
    const res1 = await service.updateLocation(driverId, {
      lat: 12.9352,
      lng: 77.6245,
      speed: 30,
    });
    expect(res1.status).toBe('acknowledged');
    expect(mockRedis.geoAdd).toHaveBeenCalledWith(
      'drivers:geo',
      77.6245,
      12.9352,
      driverId,
    );

    // 2. Realistic movement 500 meters away after 30 seconds (~60 km/h)
    // Advance recorded timestamp to simulate 30 seconds passing
    type ServiceInternals = {
      locationBuffer: Map<string, { lastLocationAt: Date }>;
      lastKnownLocations: Map<string, { lastLocationAt: Date }>;
    };
    const internals = service as unknown as ServiceInternals;
    const buf = internals.locationBuffer.get(driverId);
    if (buf) {
      buf.lastLocationAt = new Date(Date.now() - 30000);
    }
    const lastKnown = internals.lastKnownLocations.get(driverId);
    if (lastKnown) {
      lastKnown.lastLocationAt = new Date(Date.now() - 30000);
    }

    const res2 = await service.updateLocation(driverId, {
      lat: 12.939,
      lng: 77.625,
      speed: 40,
    });
    expect(res2.status).toBe('acknowledged');
  });

  it('rejects teleportation jump / impossible velocity with BadRequestException', async () => {
    const driverId = 'driver-spoof-1';

    // 1. First ping in Bengaluru South (Electronic City)
    await service.updateLocation(driverId, {
      lat: 12.8399,
      lng: 77.677,
    });

    // 2. Immediate ping in Bengaluru North (Hebbal, ~25 km away in 0 seconds)
    await expect(
      service.updateLocation(driverId, {
        lat: 13.0358,
        lng: 77.597,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects coordinates exceeding valid geographic bounds (-90..90, -180..180)', async () => {
    const driverId = 'driver-oob-1';

    await expect(
      service.updateLocation(driverId, {
        lat: 95.0, // Invalid latitude
        lng: 77.5946,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.updateLocation(driverId, {
        lat: 12.9716,
        lng: 195.0, // Invalid longitude
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
