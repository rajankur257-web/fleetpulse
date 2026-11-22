import {
  DeliveryRequest,
  DispatchStrategyType,
  Driver,
  DriverStatus,
  RequestStatus,
} from '@fleet-pulse/shared';
import { BatchStrategy } from './batch.strategy';

describe('BatchStrategy', () => {
  let strategy: BatchStrategy;

  beforeEach(() => {
    strategy = new BatchStrategy();
  });

  it('has strategy type BATCH', () => {
    expect(strategy.name).toBe(DispatchStrategyType.BATCH);
  });

  it('returns null if no candidates are provided in single assign mode', () => {
    const req: DeliveryRequest = {
      id: 'req-1',
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      dropLat: 12.9279,
      dropLng: 77.6271,
      status: RequestStatus.PENDING,
      priority: 1,
    };
    expect(strategy.assign(req, [])).toBeNull();
  });

  it('solves global bipartite matching for multiple requests and drivers', () => {
    // 2 requests in different areas of Bengaluru
    // Req A in Koramangala
    const reqA: DeliveryRequest = {
      id: 'req-A',
      pickupLat: 12.9352,
      pickupLng: 77.6245,
      dropLat: 12.9279,
      dropLng: 77.6271,
      status: RequestStatus.PENDING,
      priority: 1,
    };
    // Req B in Indiranagar
    const reqB: DeliveryRequest = {
      id: 'req-B',
      pickupLat: 12.9784,
      pickupLng: 77.6408,
      dropLat: 12.9279,
      dropLng: 77.6271,
      status: RequestStatus.PENDING,
      priority: 1,
    };

    // Driver 1 is in Koramangala (close to Req A)
    const driver1: Driver = {
      id: 'd-1',
      name: 'Koramangala Driver',
      phone: '111',
      status: DriverStatus.AVAILABLE,
      rating: 4.8,
      lat: 12.936,
      lng: 77.625,
      dailyTrips: 1,
    };

    // Driver 2 is in Indiranagar (close to Req B)
    const driver2: Driver = {
      id: 'd-2',
      name: 'Indiranagar Driver',
      phone: '222',
      status: DriverStatus.AVAILABLE,
      rating: 4.8,
      lat: 12.979,
      lng: 77.641,
      dailyTrips: 2,
    };

    const assignments = strategy.assignBatch([reqA, reqB], [driver1, driver2]);

    expect(assignments).toHaveLength(2);
    // Req A should get Driver 1 (Koramangala)
    const assignA = assignments.find((a) => a.requestId === 'req-A');
    expect(assignA).toBeDefined();
    expect(assignA!.driverId).toBe('d-1');
    expect(assignA!.strategy).toBe(DispatchStrategyType.BATCH);

    // Req B should get Driver 2 (Indiranagar)
    const assignB = assignments.find((a) => a.requestId === 'req-B');
    expect(assignB).toBeDefined();
    expect(assignB!.driverId).toBe('d-2');
  });

  it('handles more requests than available drivers gracefully', () => {
    const req1: DeliveryRequest = {
      id: 'req-1',
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      dropLat: 12.9279,
      dropLng: 77.6271,
      status: RequestStatus.PENDING,
      priority: 1,
    };
    const req2: DeliveryRequest = {
      id: 'req-2',
      pickupLat: 12.972,
      pickupLng: 77.595,
      dropLat: 12.9279,
      dropLng: 77.6271,
      status: RequestStatus.PENDING,
      priority: 1,
    };

    const driver1: Driver = {
      id: 'd-1',
      name: 'Only Driver',
      phone: '111',
      status: DriverStatus.AVAILABLE,
      rating: 5.0,
      lat: 12.9718,
      lng: 77.5948,
      dailyTrips: 0,
    };

    const assignments = strategy.assignBatch([req1, req2], [driver1]);

    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.driverId).toBe('d-1');
  });

  it('ignores busy or offline drivers in batch matching', () => {
    const req1: DeliveryRequest = {
      id: 'req-1',
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      dropLat: 12.9279,
      dropLng: 77.6271,
      status: RequestStatus.PENDING,
      priority: 1,
    };

    const busyDriver: Driver = {
      id: 'd-busy',
      name: 'Busy',
      phone: '111',
      status: DriverStatus.BUSY,
      rating: 5.0,
      lat: 12.9716,
      lng: 77.5946,
      dailyTrips: 0,
    };

    const assignments = strategy.assignBatch([req1], [busyDriver]);
    expect(assignments).toHaveLength(0);
  });
});
