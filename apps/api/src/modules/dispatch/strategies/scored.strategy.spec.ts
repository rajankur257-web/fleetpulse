import {
  DeliveryRequest,
  DispatchContext,
  DispatchStrategyType,
  Driver,
  DriverStatus,
  RequestStatus,
} from '@fleet-pulse/shared';
import { ScoredStrategy } from './scored.strategy';

describe('ScoredStrategy', () => {
  let strategy: ScoredStrategy;

  beforeEach(() => {
    strategy = new ScoredStrategy();
  });

  const baseRequest: DeliveryRequest = {
    id: 'req-1',
    pickupLat: 12.9716,
    pickupLng: 77.5946,
    dropLat: 12.9279,
    dropLng: 77.6271,
    status: RequestStatus.PENDING,
    priority: 1,
  };

  const now = new Date('2026-11-22T12:00:00Z');

  it('has strategy type SCORED', () => {
    expect(strategy.name).toBe(DispatchStrategyType.SCORED);
  });

  it('returns null when candidates list is empty', () => {
    expect(strategy.assign(baseRequest, [])).toBeNull();
  });

  it('filters out unavailable drivers', () => {
    const candidates: Driver[] = [
      {
        id: 'd-1',
        name: 'Busy',
        phone: '111',
        status: DriverStatus.BUSY,
        rating: 5.0,
        lat: 12.9716,
        lng: 77.5946,
        dailyTrips: 0,
      },
    ];
    expect(strategy.assign(baseRequest, candidates)).toBeNull();
  });

  it('favors higher rating when distance is equal', () => {
    const driverHighRating: Driver = {
      id: 'd-high-rating',
      name: 'High Rating Driver',
      phone: '111',
      status: DriverStatus.AVAILABLE,
      rating: 5.0,
      lat: 12.972,
      lng: 77.595,
      dailyTrips: 2,
      lastLocationAt: new Date('2026-11-22T11:50:00Z'),
    };

    const driverLowRating: Driver = {
      id: 'd-low-rating',
      name: 'Low Rating Driver',
      phone: '222',
      status: DriverStatus.AVAILABLE,
      rating: 3.5,
      lat: 12.972,
      lng: 77.595,
      dailyTrips: 2,
      lastLocationAt: new Date('2026-11-22T11:50:00Z'),
    };

    const result = strategy.assign(baseRequest, [driverLowRating, driverHighRating], {
      activeStrategy: DispatchStrategyType.SCORED,
      now,
    });

    expect(result).not.toBeNull();
    expect(result!.driverId).toBe('d-high-rating');
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.strategy).toBe(DispatchStrategyType.SCORED);
  });

  it('favors driver with fewer daily trips when fairness weight is emphasized', () => {
    const busyVeteran: Driver = {
      id: 'd-veteran',
      name: 'Veteran',
      phone: '111',
      status: DriverStatus.AVAILABLE,
      rating: 4.8,
      lat: 12.972,
      lng: 77.595,
      dailyTrips: 15,
      lastLocationAt: new Date('2026-11-22T11:50:00Z'),
    };

    const noviceDriver: Driver = {
      id: 'd-novice',
      name: 'Novice',
      phone: '222',
      status: DriverStatus.AVAILABLE,
      rating: 4.8,
      lat: 12.972,
      lng: 77.595,
      dailyTrips: 0,
      lastLocationAt: new Date('2026-11-22T11:50:00Z'),
    };

    const context: DispatchContext = {
      activeStrategy: DispatchStrategyType.SCORED,
      weights: {
        distance: 0.1,
        rating: 0.1,
        idleTime: 0.1,
        dailyTrips: 0.7, // Heavy fairness weight
      },
      now,
    };

    const result = strategy.assign(baseRequest, [busyVeteran, noviceDriver], context);
    expect(result).not.toBeNull();
    expect(result!.driverId).toBe('d-novice');
  });

  it('favors driver waiting longer (idle time) when distance and rating are identical', () => {
    const idleLongTime: Driver = {
      id: 'd-idle-long',
      name: 'Idle Long',
      phone: '111',
      status: DriverStatus.AVAILABLE,
      rating: 4.9,
      lat: 12.972,
      lng: 77.595,
      dailyTrips: 3,
      lastLocationAt: new Date('2026-11-22T11:00:00Z'), // 60 min ago
    };

    const justAvailable: Driver = {
      id: 'd-idle-short',
      name: 'Idle Short',
      phone: '222',
      status: DriverStatus.AVAILABLE,
      rating: 4.9,
      lat: 12.972,
      lng: 77.595,
      dailyTrips: 3,
      lastLocationAt: new Date('2026-11-22T11:58:00Z'), // 2 min ago
    };

    const result = strategy.assign(baseRequest, [justAvailable, idleLongTime], {
      activeStrategy: DispatchStrategyType.SCORED,
      now,
    });

    expect(result).not.toBeNull();
    expect(result!.driverId).toBe('d-idle-long');
  });
});
