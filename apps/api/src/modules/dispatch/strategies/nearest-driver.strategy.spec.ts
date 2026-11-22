import {
  DeliveryRequest,
  DispatchStrategyType,
  Driver,
  DriverStatus,
  RequestStatus,
} from '@fleet-pulse/shared';
import { NearestDriverStrategy } from './nearest-driver.strategy';

describe('NearestDriverStrategy', () => {
  let strategy: NearestDriverStrategy;

  beforeEach(() => {
    strategy = new NearestDriverStrategy();
  });

  const baseRequest: DeliveryRequest = {
    id: 'req-1',
    pickupLat: 12.9716, // Bengaluru center
    pickupLng: 77.5946,
    dropLat: 12.9279, // Koramangala
    dropLng: 77.6271,
    status: RequestStatus.PENDING,
    priority: 1,
  };

  it('has strategy type NEAREST', () => {
    expect(strategy.name).toBe(DispatchStrategyType.NEAREST);
  });

  it('returns null when candidates list is empty', () => {
    const result = strategy.assign(baseRequest, []);
    expect(result).toBeNull();
  });

  it('returns null when no candidate is available', () => {
    const candidates: Driver[] = [
      {
        id: 'd-1',
        name: 'Busy Driver',
        phone: '123',
        status: DriverStatus.BUSY,
        rating: 5,
        lat: 12.972,
        lng: 77.595,
        dailyTrips: 0,
      },
      {
        id: 'd-2',
        name: 'Offline Driver',
        phone: '456',
        status: DriverStatus.OFFLINE,
        rating: 4.8,
        lat: 12.9718,
        lng: 77.5948,
        dailyTrips: 1,
      },
    ];

    const result = strategy.assign(baseRequest, candidates);
    expect(result).toBeNull();
  });

  it('assigns to the closest available driver using haversine distance', () => {
    const farDriver: Driver = {
      id: 'd-far',
      name: 'Far Driver',
      phone: '111',
      status: DriverStatus.AVAILABLE,
      rating: 5.0,
      lat: 13.0827, // Chennai (~290 km away)
      lng: 80.2707,
      dailyTrips: 2,
    };

    const nearDriver: Driver = {
      id: 'd-near',
      name: 'Near Driver',
      phone: '222',
      status: DriverStatus.AVAILABLE,
      rating: 4.5,
      lat: 12.972, // ~50 meters from pickup
      lng: 77.595,
      dailyTrips: 5,
    };

    const midDriver: Driver = {
      id: 'd-mid',
      name: 'Mid Driver',
      phone: '333',
      status: DriverStatus.AVAILABLE,
      rating: 4.9,
      lat: 12.98, // ~1 km from pickup
      lng: 77.6,
      dailyTrips: 0,
    };

    const result = strategy.assign(baseRequest, [farDriver, nearDriver, midDriver]);

    expect(result).not.toBeNull();
    expect(result!.driverId).toBe('d-near');
    expect(result!.requestId).toBe('req-1');
    expect(result!.strategy).toBe(DispatchStrategyType.NEAREST);
    expect(result!.distanceKm).toBeLessThan(0.1);
    expect(result!.assignedAt).toBeInstanceOf(Date);
  });

  it('ignores busy drivers even if they are closer', () => {
    const superCloseBusyDriver: Driver = {
      id: 'd-close-busy',
      name: 'Busy Close',
      phone: '111',
      status: DriverStatus.BUSY,
      rating: 5.0,
      lat: 12.9716, // exactly at pickup
      lng: 77.5946,
      dailyTrips: 2,
    };

    const availableDriver: Driver = {
      id: 'd-available',
      name: 'Available',
      phone: '222',
      status: DriverStatus.AVAILABLE,
      rating: 4.5,
      lat: 12.973, // ~200m away
      lng: 77.595,
      dailyTrips: 1,
    };

    const result = strategy.assign(baseRequest, [superCloseBusyDriver, availableDriver]);
    expect(result).not.toBeNull();
    expect(result!.driverId).toBe('d-available');
  });
});
