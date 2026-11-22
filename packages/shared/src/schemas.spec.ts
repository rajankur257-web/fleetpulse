import { describe, expect, it } from 'vitest';
import {
  DriverStatus,
  RequestStatus,
  UserRole,
  CoordinatesSchema,
  DriverSchema,
  DeliveryRequestSchema,
  DispatchEventSchema,
  DriverLocationEventSchema,
  DriverStatusEventSchema,
  RequestOfferedEventSchema,
  RequestAssignedEventSchema,
  RequestExpiredEventSchema,
  RequestCancelledEventSchema,
} from './index';

describe('Zod Schemas and Contract Validation', () => {
  it('validates UserRole enums', () => {
    expect(UserRole.ADMIN).toBe('admin');
    expect(UserRole.DISPATCHER).toBe('dispatcher');
    expect(UserRole.DRIVER).toBe('driver');
  });

  describe('CoordinatesSchema', () => {
    it('validates correct latitude and longitude ranges', () => {
      const valid = CoordinatesSchema.safeParse({ lat: 12.9716, lng: 77.5946 });
      expect(valid.success).toBe(true);
    });

    it('rejects coordinates out of bounds', () => {
      expect(CoordinatesSchema.safeParse({ lat: 95, lng: 77 }).success).toBe(false);
      expect(CoordinatesSchema.safeParse({ lat: -95, lng: 77 }).success).toBe(false);
      expect(CoordinatesSchema.safeParse({ lat: 12, lng: 185 }).success).toBe(false);
      expect(CoordinatesSchema.safeParse({ lat: 12, lng: -185 }).success).toBe(false);
    });
  });

  describe('DriverSchema', () => {
    it('validates a complete driver object', () => {
      const driver = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Rohan Kumar',
        phone: '+919876543210',
        status: DriverStatus.AVAILABLE,
        rating: 4.8,
        lat: 12.9716,
        lng: 77.5946,
        dailyTrips: 3,
        lastLocationAt: new Date().toISOString(),
        activeRequestId: null,
      };
      const parsed = DriverSchema.safeParse(driver);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid driver status', () => {
      const invalidDriver = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Driver',
        phone: '+919876543210',
        status: 'sleeping', // invalid enum
        rating: 4.8,
        lat: 12.9716,
        lng: 77.5946,
      };
      expect(DriverSchema.safeParse(invalidDriver).success).toBe(false);
    });
  });

  describe('DeliveryRequestSchema', () => {
    it('validates delivery request with all pickup and dropoff points', () => {
      const request = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        pickupLat: 12.9352,
        pickupLng: 77.6245,
        dropLat: 12.9784,
        dropLng: 77.6408,
        status: RequestStatus.PENDING,
        priority: 1,
        assignedDriverId: null,
      };
      expect(DeliveryRequestSchema.safeParse(request).success).toBe(true);
    });
  });

  describe('DispatchEventSchema', () => {
    it('validates dispatch event with payload', () => {
      const event = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        requestId: '123e4567-e89b-12d3-a456-426614174001',
        driverId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'request:offered',
        payload: { attempt: 1, timeoutSeconds: 20 },
        createdAt: new Date().toISOString(),
      };
      expect(DispatchEventSchema.safeParse(event).success).toBe(true);
    });
  });

  describe('Socket.IO Event Schemas', () => {
    it('validates driver:location event', () => {
      const locEvent = {
        driverId: 'drv-1',
        lat: 12.9716,
        lng: 77.5946,
        heading: 180,
        speed: 35.5,
        updatedAt: new Date().toISOString(),
      };
      expect(DriverLocationEventSchema.safeParse(locEvent).success).toBe(true);
    });

    it('validates driver:status event', () => {
      const statusEvent = {
        driverId: 'drv-1',
        status: DriverStatus.BUSY,
        activeRequestId: 'req-1',
      };
      expect(DriverStatusEventSchema.safeParse(statusEvent).success).toBe(true);
    });

    it('validates request:offered event', () => {
      const offerEvent = {
        requestId: 'req-1',
        driverId: 'drv-1',
        attempt: 1,
        expiresAt: new Date(Date.now() + 20000).toISOString(),
        timeoutSeconds: 20,
      };
      expect(RequestOfferedEventSchema.safeParse(offerEvent).success).toBe(true);
    });

    it('validates request:assigned event', () => {
      const assignedEvent = {
        requestId: 'req-1',
        driverId: 'drv-1',
        assignedAt: new Date().toISOString(),
      };
      expect(RequestAssignedEventSchema.safeParse(assignedEvent).success).toBe(true);
    });

    it('validates request:expired event', () => {
      const expiredEvent = {
        requestId: 'req-1',
        reason: 'Max offer attempts reached',
      };
      expect(RequestExpiredEventSchema.safeParse(expiredEvent).success).toBe(true);
    });

    it('validates request:cancelled event', () => {
      const cancelledEvent = {
        requestId: 'req-1',
        reason: 'Customer cancelled',
      };
      expect(RequestCancelledEventSchema.safeParse(cancelledEvent).success).toBe(true);
    });
  });
});
