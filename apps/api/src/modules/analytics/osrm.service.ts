import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Coordinates,
  EtaComparisonResult,
  etaMinutes,
  haversineKm,
} from '@fleet-pulse/shared';

export interface OsrmRouteResult {
  distanceKm: number;
  durationMinutes: number;
  isAvailable: boolean;
}

@Injectable()
export class OsrmService {
  private readonly logger = new Logger(OsrmService.name);
  private readonly osrmUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.osrmUrl =
      this.configService.get<string>('OSRM_URL') ||
      'http://router.project-osrm.org';
  }

  /**
   * Fetches road-network driving route from OSRM, falling back to Haversine calculation
   */
  async getRoute(origin: Coordinates, destination: Coordinates): Promise<OsrmRouteResult> {
    const haversineDist = haversineKm(origin, destination);
    const fallbackEta = etaMinutes(haversineDist, 30);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    try {
      const url = `${this.osrmUrl}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`OSRM HTTP error: status ${response.status}`);
      }

      interface OsrmApiResponse {
        code?: string;
        routes?: Array<{
          distance: number;
          duration: number;
        }>;
      }
      const data = (await response.json()) as OsrmApiResponse;
      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0]!;
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMinutes = Math.max(1, Math.round(route.duration / 60));

        return {
          distanceKm,
          durationMinutes,
          isAvailable: true,
        };
      }

      throw new Error(`OSRM returned code: ${data.code ?? 'unknown'}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.debug(
        `OSRM routing unavailable (${message}). Falling back to Haversine estimation.`,
      );

      // Urban road detour factor is typically ~1.25x - 1.35x of direct Haversine distance
      const estimatedRoadDistance = Math.round(haversineDist * 1.3 * 10) / 10;

      return {
        distanceKm: estimatedRoadDistance,
        durationMinutes: fallbackEta,
        isAvailable: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Compares direct Haversine distance & ETA against OSRM road network metrics
   */
  async compareEta(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<EtaComparisonResult> {
    const haversineDistance = Math.round(haversineKm(origin, destination) * 10) / 10;
    const haversineEta = etaMinutes(haversineDistance, 30);

    const osrm = await this.getRoute(origin, destination);

    const detourFactor =
      haversineDistance > 0
        ? Math.round((osrm.distanceKm / haversineDistance) * 100) / 100
        : 1.0;

    return {
      origin,
      destination,
      haversine: {
        distanceKm: haversineDistance,
        etaMinutes: haversineEta,
      },
      osrm: {
        distanceKm: osrm.distanceKm,
        durationMinutes: osrm.durationMinutes,
        isAvailable: osrm.isAvailable,
      },
      detourFactor,
    };
  }

  private readonly pathCache = new Map<string, Coordinates[]>();

  /**
   * Fetches detailed turn-by-turn road geometry coordinates from OSRM,
   * falling back to interpolated line waypoints if OSRM is unreachable.
   */
  async getRoutePath(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<Coordinates[]> {
    const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    const cached = this.pathCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const url = `${this.osrmUrl}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`OSRM HTTP error: status ${response.status}`);
      }

      interface OsrmGeoJsonResponse {
        code?: string;
        routes?: Array<{
          geometry?: {
            coordinates?: Array<[number, number]>;
          };
        }>;
      }

      const data = (await response.json()) as OsrmGeoJsonResponse;
      if (
        data.code === 'Ok' &&
        Array.isArray(data.routes) &&
        data.routes.length > 0 &&
        data.routes[0]?.geometry?.coordinates &&
        data.routes[0].geometry.coordinates.length > 0
      ) {
        const waypoints: Coordinates[] = data.routes[0].geometry.coordinates.map(
          ([lng, lat]) => ({ lat, lng }),
        );

        if (this.pathCache.size > 1000) {
          const firstKey = this.pathCache.keys().next().value;
          if (firstKey) this.pathCache.delete(firstKey);
        }
        this.pathCache.set(cacheKey, waypoints);
        return waypoints;
      }

      throw new Error(`OSRM returned code: ${data.code ?? 'unknown'}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.debug(
        `OSRM path query failed (${message}). Generating fallback waypoints.`,
      );

      const count = 5;
      const fallback: Coordinates[] = [];
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        fallback.push({
          lat: Number((origin.lat + (destination.lat - origin.lat) * t).toFixed(6)),
          lng: Number((origin.lng + (destination.lng - origin.lng) * t).toFixed(6)),
        });
      }
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }
}
