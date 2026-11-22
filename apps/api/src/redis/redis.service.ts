import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface NearbyGeoDriver {
  id: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.logger.log(`Connecting to Redis at ${redisUrl.split('@')[1] || redisUrl}`);

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client successfully connected');
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  /**
   * Adds or updates driver geographic location in Redis GEO set 'drivers:geo'
   */
  async geoAdd(
    key: string,
    lng: number,
    lat: number,
    member: string,
  ): Promise<number> {
    return this.client.geoadd(key, lng, lat, member);
  }

  /**
   * Searches for nearby drivers within radiusKm from [lng, lat]
   */
  async geoSearch(
    key: string,
    lng: number,
    lat: number,
    radiusKm: number,
  ): Promise<NearbyGeoDriver[]> {
    try {
      // Use GEOSEARCH (Redis 6.2+) with distance and coordinates
      const results = (await this.client.call(
        'GEOSEARCH',
        key,
        'FROMLONLAT',
        lng.toString(),
        lat.toString(),
        'BYRADIUS',
        radiusKm.toString(),
        'km',
        'WITHDIST',
        'WITHCOORD',
        'ASC',
      )) as Array<[string, string, [string, string]]>;

      if (!results || !Array.isArray(results)) {
        return [];
      }

      return results.map(([member, distStr, [coordLng, coordLat]]) => ({
        id: member,
        distanceKm: parseFloat(distStr),
        lng: parseFloat(coordLng),
        lat: parseFloat(coordLat),
      }));
    } catch (error) {
      this.logger.warn(`GEOSEARCH failed, falling back to GEORADIUS: ${error}`);
      try {
        const fallbackResults = (await this.client.georadius(
          key,
          lng,
          lat,
          radiusKm,
          'km',
          'WITHDIST',
          'WITHCOORD',
          'ASC',
        )) as unknown as Array<[string, string, [string, string]]>;

        if (!fallbackResults || !Array.isArray(fallbackResults)) {
          return [];
        }

        return fallbackResults.map(([member, distStr, [coordLng, coordLat]]) => ({
          id: member,
          distanceKm: parseFloat(distStr),
          lng: parseFloat(coordLng),
          lat: parseFloat(coordLat),
        }));
      } catch (fbError) {
        this.logger.error(`Both GEOSEARCH and GEORADIUS failed: ${fbError}`);
        return [];
      }
    }
  }
}
