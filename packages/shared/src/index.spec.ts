import { describe, expect, it } from 'vitest';
import { FLEET_PULSE_VERSION, DriverStatus, RequestStatus, UserRole } from './index';

describe('Shared package smoke test', () => {
  it('exports correct version and enums', () => {
    expect(FLEET_PULSE_VERSION).toBe('0.1.0');
    expect(DriverStatus.AVAILABLE).toBe('available');
    expect(RequestStatus.PENDING).toBe('pending');
    expect(UserRole.DISPATCHER).toBe('dispatcher');
  });
});
