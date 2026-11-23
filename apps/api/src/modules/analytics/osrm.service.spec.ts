import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OsrmService } from './osrm.service';

describe('OsrmService', () => {
  let service: OsrmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OsrmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OSRM_URL') return 'http://mock-osrm.org';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OsrmService>(OsrmService);
  });

  it('falls back to Haversine calculation when OSRM endpoint fails or times out', async () => {
    // Force fetch failure
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection timed out'));

    const origin = { lat: 12.9716, lng: 77.5946 };
    const destination = { lat: 12.9352, lng: 77.6245 }; // ~5.2 km

    const result = await service.compareEta(origin, destination);

    expect(result.osrm.isAvailable).toBe(false);
    expect(result.haversine.distanceKm).toBeGreaterThan(4);
    expect(result.haversine.distanceKm).toBeLessThan(7);
    expect(result.haversine.etaMinutes).toBeGreaterThan(0);
    expect(result.detourFactor).toBeGreaterThanOrEqual(1.0);
  });

  it('parses valid OSRM driving route response correctly', async () => {
    const mockOsrmResponse = {
      code: 'Ok',
      routes: [
        {
          distance: 6500, // 6.5 km
          duration: 900,  // 15 min
        },
      ],
    };

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockOsrmResponse,
    } as unknown as Response);

    const origin = { lat: 12.9716, lng: 77.5946 };
    const destination = { lat: 12.9352, lng: 77.6245 };

    const result = await service.compareEta(origin, destination);

    expect(result.osrm.isAvailable).toBe(true);
    expect(result.osrm.distanceKm).toBeCloseTo(6.5, 1);
    expect(result.osrm.durationMinutes).toBe(15);
    expect(result.detourFactor).toBeGreaterThan(1.0);
  });

  it('parses valid OSRM GeoJSON route geometry coordinates into LatLng waypoints', async () => {
    const mockGeoJsonResponse = {
      code: 'Ok',
      routes: [
        {
          distance: 4200,
          duration: 600,
          geometry: {
            coordinates: [
              [77.5946, 12.9716],
              [77.6000, 12.9600],
              [77.6245, 12.9352],
            ],
          },
        },
      ],
    };

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockGeoJsonResponse,
    } as unknown as Response);

    const origin = { lat: 12.9716, lng: 77.5946 };
    const destination = { lat: 12.9352, lng: 77.6245 };

    const path = await service.getRoutePath(origin, destination);

    expect(path).toHaveLength(3);
    expect(path[0]).toEqual({ lat: 12.9716, lng: 77.5946 });
    expect(path[1]).toEqual({ lat: 12.96, lng: 77.6 });
    expect(path[2]).toEqual({ lat: 12.9352, lng: 77.6245 });
  });

  it('returns fallback linear waypoints when OSRM geometry query fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const origin = { lat: 12.9716, lng: 77.5946 };
    const destination = { lat: 12.9352, lng: 77.6245 };

    const path = await service.getRoutePath(origin, destination);

    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual(origin);
    expect(path[path.length - 1]).toEqual(destination);
  });
});
