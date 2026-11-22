import { PulseScoreService } from './pulse-score.service';
import { DriverStatus } from '@fleet-pulse/shared';

describe('PulseScoreService', () => {
  let service: PulseScoreService;

  beforeEach(() => {
    service = new PulseScoreService();
  });

  it('calculates perfect 100 Pulse Score for busy, active, high-acceptance driver near demand', () => {
    const driver = {
      id: 'd1',
      name: 'Top Driver',
      status: DriverStatus.BUSY,
      rating: 4.9,
      lat: 12.9716,
      lng: 77.5946,
      dailyTrips: 12,
      lastLocationAt: new Date(),
    };

    const stats = {
      acceptedOffers: 20,
      rejectedOffers: 0,
    };

    const demandHotspots = [
      { lat: 12.9716, lng: 77.5946, weight: 1.5 }, // exactly at hotspot
    ];

    const result = service.calculateDriverScore(driver, stats, demandHotspots);

    expect(result.pulseScore).toBeGreaterThanOrEqual(95);
    expect(result.pulseScore).toBeLessThanOrEqual(100);
    expect(result.components.acceptanceScore).toBe(100);
    expect(result.components.idleScore).toBe(100);
    expect(result.components.proximityScore).toBe(100);
  });

  it('penalizes driver with low acceptance rate and high idle time', () => {
    const twentyHoursAgo = new Date(Date.now() - 3600 * 1000 * 2);
    const driver = {
      id: 'd2',
      name: 'Idle Low-Accept Driver',
      status: DriverStatus.AVAILABLE,
      rating: 3.5,
      lat: 13.5, // Far outside demand
      lng: 78.2,
      dailyTrips: 1,
      lastLocationAt: twentyHoursAgo,
    };

    const stats = {
      acceptedOffers: 2,
      rejectedOffers: 8, // 20% acceptance rate
    };

    const demandHotspots = [
      { lat: 12.9716, lng: 77.5946, weight: 1.5 },
    ];

    const result = service.calculateDriverScore(driver, stats, demandHotspots);

    expect(result.pulseScore).toBeLessThan(45);
    expect(result.components.acceptanceScore).toBe(20);
    expect(result.components.proximityScore).toBeLessThan(30);
  });

  it('clamps Pulse Score strictly within [0, 100]', () => {
    const driver = {
      id: 'd3',
      name: 'Offline Driver',
      status: DriverStatus.OFFLINE,
      rating: 1.0,
      lat: 0,
      lng: 0,
      dailyTrips: 0,
      lastLocationAt: null,
    };

    const result = service.calculateDriverScore(driver, { acceptedOffers: 0, rejectedOffers: 50 }, []);

    expect(result.pulseScore).toBeGreaterThanOrEqual(0);
    expect(result.pulseScore).toBeLessThanOrEqual(100);
  });
});
