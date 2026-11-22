import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import {
  haversineKm,
  etaMinutes,
  DriverStatus,
  RequestStatus,
  UserRole,
  DeliveryRequestSchema,
} from '@fleet-pulse/shared';

describe('AppModule Smoke Test', () => {
  it('should compile the module', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it('should successfully import and execute @fleet-pulse/shared utilities', () => {
    const blr = { lat: 12.9716, lng: 77.5946 };
    const chn = { lat: 13.0827, lng: 80.2707 };
    const dist = haversineKm(blr, chn);
    expect(Math.round(dist)).toBe(290);

    const eta = etaMinutes(dist, 30);
    expect(eta).toBeGreaterThan(0);

    expect(DriverStatus.AVAILABLE).toBe('available');
    expect(RequestStatus.PENDING).toBe('pending');
    expect(UserRole.ADMIN).toBe('admin');

    const valid = DeliveryRequestSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      dropLat: 13.0827,
      dropLng: 80.2707,
      status: RequestStatus.PENDING,
      priority: 1,
    });
    expect(valid.success).toBe(true);
  });
});

