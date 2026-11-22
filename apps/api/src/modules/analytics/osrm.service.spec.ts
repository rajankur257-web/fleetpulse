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
});
