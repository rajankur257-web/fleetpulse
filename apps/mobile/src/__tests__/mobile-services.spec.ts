import { DriverStatus, RequestStatus, haversineKm } from '@fleet-pulse/shared';
import { OFFER_TIMEOUT_SECONDS } from '../lib/constants';

describe('Mobile App Driver Utilities & Business Logic', () => {
  it('correctly calculates Haversine trip distance and estimated payout', () => {
    // Koramangala to Indiranagar
    const pickup = { lat: 12.9352, lng: 77.6245 };
    const drop = { lat: 12.9784, lng: 77.6408 };

    const distanceKm = haversineKm(pickup, drop);
    expect(distanceKm).toBeGreaterThan(4);
    expect(distanceKm).toBeLessThan(7);

    // Formula: ₹50 base + ₹15/km
    const estimatedFare = Math.round(50 + distanceKm * 15);
    expect(estimatedFare).toBeGreaterThan(100);
    expect(estimatedFare).toBeLessThan(200);
  });

  it('validates DriverStatus lifecycle transitions', () => {
    const validStatuses = [
      DriverStatus.AVAILABLE,
      DriverStatus.BUSY,
      DriverStatus.OFFLINE,
    ];

    expect(validStatuses).toContain('available');
    expect(validStatuses).toContain('busy');
    expect(validStatuses).toContain('offline');
  });

  it('validates DeliveryRequest progression stages', () => {
    const progression = [
      RequestStatus.PENDING,
      RequestStatus.OFFERED,
      RequestStatus.ASSIGNED,
      RequestStatus.PICKED_UP,
      RequestStatus.DELIVERED,
    ];

    expect(progression[2]).toBe('assigned');
    expect(progression[3]).toBe('picked_up');
    expect(progression[4]).toBe('delivered');
  });

  it('verifies default offer timeout is 20 seconds', () => {
    expect(OFFER_TIMEOUT_SECONDS).toBe(20);
  });
});
