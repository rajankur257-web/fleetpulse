import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { Driver, DriverStatus } from '@prisma/client';
import { DriverStatus as SharedDriverStatus, haversineKm } from '@fleet-pulse/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EventsGateway } from '../realtime/events.gateway';
import { CreateDriverDto } from './dto/create-driver.dto';
import { QueryDriversDto } from './dto/query-drivers.dto';
import { UpdateDriverLocationDto } from './dto/update-driver-location.dto';

export interface NearbyDriverResult {
  id: string;
  name: string;
  phone: string;
  status: DriverStatus;
  rating: number;
  lat: number;
  lng: number;
  distanceKm: number;
  source: 'redis' | 'postgis';
}

@Injectable()
export class DriversService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DriversService.name);
  private locationBuffer: Map<
    string,
    { lat: number; lng: number; lastLocationAt: Date }
  > = new Map();
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Optional()
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway?: EventsGateway,
  ) {}

  onModuleInit() {
    // Periodically flush batched driver location writes to PostgreSQL every 2 seconds
    this.flushTimer = setInterval(() => {
      this.flushLocationBuffer().catch((err) => {
        this.logger.error(`Error in periodic location flush: ${err.message}`);
      });
    }, 2000);
  }

  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushLocationBuffer();
  }

  async create(dto: CreateDriverDto): Promise<Driver> {
    const driver = await this.prisma.driver.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        lat: Number(dto.lat),
        lng: Number(dto.lng),
        status: dto.status || DriverStatus.available,
        rating: dto.rating !== undefined ? Number(dto.rating) : 5.0,
        lastLocationAt: new Date(),
      },
    });

    // Write to Redis GEO hot path
    await this.redis.geoAdd('drivers:geo', driver.lng, driver.lat, driver.id);

    return driver;
  }

  async findAll(query: QueryDriversDto): Promise<{
    data: Driver[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where = query.status ? { status: query.status } : {};

    const [data, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID "${id}" not found`);
    }

    return driver;
  }

  async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
    await this.findOne(id); // Throws if not found

    const updated = await this.prisma.driver.update({
      where: { id },
      data: { status },
    });

    if (this.eventsGateway) {
      this.eventsGateway.broadcastDriverStatus({
        driverId: id,
        status: status as unknown as SharedDriverStatus,
        activeRequestId: updated.activeRequestId,
      });
    }

    return updated;
  }

  /**
   * Hot path: writes location to Redis GEO immediately and buffers update for PostgreSQL batch write
   */
  async updateLocation(
    id: string,
    dto: UpdateDriverLocationDto,
  ): Promise<{ status: string; id: string; lat: number; lng: number }> {
    const lat = Number(dto.lat);
    const lng = Number(dto.lng);

    // 1. Immediate hot-path write to Redis GEO
    await this.redis.geoAdd('drivers:geo', lng, lat, id);

    // 2. Buffer write for PostgreSQL batch persistence
    const now = new Date();
    this.locationBuffer.set(id, {
      lat,
      lng,
      lastLocationAt: now,
    });

    // 3. Broadcast location to dispatchers room via Socket.IO (throttled at 1/sec/driver)
    if (this.eventsGateway) {
      this.eventsGateway.broadcastDriverLocation({
        driverId: id,
        lat,
        lng,
        heading: dto.heading,
        speed: dto.speed,
        updatedAt: now.toISOString(),
      });
    }

    return {
      status: 'acknowledged',
      id,
      lat,
      lng,
    };
  }

  /**
   * Flushes buffered location pings to PostgreSQL in a single batch
   */
  async flushLocationBuffer(): Promise<number> {
    if (this.locationBuffer.size === 0) {
      return 0;
    }

    const entries = Array.from(this.locationBuffer.entries());
    this.locationBuffer.clear();

    const updates = entries.map(([id, coords]) =>
      this.prisma.driver.update({
        where: { id },
        data: {
          lat: coords.lat,
          lng: coords.lng,
          lastLocationAt: coords.lastLocationAt,
        },
      }),
    );

    try {
      await this.prisma.$transaction(updates);
      return updates.length;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Failed to flush location updates: ${error.message}`);
      return 0;
    }
  }

  /**
   * Finds nearby drivers using Redis GEO (hot path) with fallback to PostGIS (ST_DWithin on GiST index)
   */
  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<NearbyDriverResult[]> {
    const queryPoint = { lat, lng };

    // 1. Attempt lookup in Redis GEO hot path
    const redisResults = await this.redis.geoSearch(
      'drivers:geo',
      lng,
      lat,
      radiusKm,
    );

    if (redisResults.length > 0) {
      const driverIds = redisResults.map((r) => r.id);
      const drivers = await this.prisma.driver.findMany({
        where: {
          id: { in: driverIds },
          status: DriverStatus.available,
        },
      });

      const driverMap = new Map(drivers.map((d) => [d.id, d]));

      const matched: NearbyDriverResult[] = [];
      for (const res of redisResults) {
        const driver = driverMap.get(res.id);
        if (driver) {
          const distanceKm = haversineKm(queryPoint, {
            lat: driver.lat,
            lng: driver.lng,
          });
          matched.push({
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            status: driver.status,
            rating: driver.rating,
            lat: driver.lat,
            lng: driver.lng,
            distanceKm: Number(distanceKm.toFixed(2)),
            source: 'redis',
          });
        }
      }

      matched.sort((a, b) => a.distanceKm - b.distanceKm);
      return matched;
    }

    // 2. Fallback to PostGIS ST_DWithin query using GiST index
    this.logger.log('Redis GEO returned 0 results, falling back to PostGIS ST_DWithin');
    const radiusMeters = radiusKm * 1000;

    const postgisDrivers = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        phone: string;
        status: DriverStatus;
        rating: number;
        lat: number;
        lng: number;
      }>
    >`
      SELECT id, name, phone, status, rating, lat, lng
      FROM "Driver"
      WHERE status = 'available'
        AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
      LIMIT 50;
    `;

    const results: NearbyDriverResult[] = postgisDrivers.map((d) => {
      const distanceKm = haversineKm(queryPoint, { lat: d.lat, lng: d.lng });
      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        status: d.status,
        rating: d.rating,
        lat: d.lat,
        lng: d.lng,
        distanceKm: Number(distanceKm.toFixed(2)),
        source: 'postgis',
      };
    });

    results.sort((a, b) => a.distanceKm - b.distanceKm);
    return results;
  }
}
