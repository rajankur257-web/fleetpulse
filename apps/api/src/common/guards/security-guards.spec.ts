import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@fleet-pulse/shared';
import { DriverOwnershipGuard } from './driver-ownership.guard';
import { RolesGuard } from './roles.guard';

describe('Security Guards (M10: Role Isolation & Driver Ownership)', () => {
  describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new RolesGuard(reflector);
    });

    const createMockContext = (
      user?: { role?: UserRole; driverId?: string | null } | null,
    ) => {
      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as unknown as ExecutionContext;
    };

    it('allows access when endpoint has no @Roles() constraint', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
      const ctx = createMockContext({ role: UserRole.DRIVER });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows access when user holds required role (Dispatcher)', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN, UserRole.DISPATCHER]);

      const ctx = createMockContext({ role: UserRole.DISPATCHER });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects access with ForbiddenException when driver attempts to call dispatcher endpoint', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN, UserRole.DISPATCHER]);

      const ctx = createMockContext({ role: UserRole.DRIVER });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('rejects access when user is unauthenticated or has no role', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN]);

      const ctx = createMockContext(null);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('DriverOwnershipGuard', () => {
    let guard: DriverOwnershipGuard;

    beforeEach(() => {
      guard = new DriverOwnershipGuard();
    });

    const createMockContext = (
      user: { role: UserRole; driverId?: string | null },
      targetDriverId: string,
    ) => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            user,
            params: { id: targetDriverId },
          }),
        }),
      } as unknown as ExecutionContext;
    };

    it('allows Admin to update any driver status or location', () => {
      const ctx = createMockContext(
        { role: UserRole.ADMIN, driverId: null },
        'any-driver-uuid',
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows Dispatcher to update any driver status or location', () => {
      const ctx = createMockContext(
        { role: UserRole.DISPATCHER, driverId: null },
        'driver-uuid-42',
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows a Driver to update their OWN location and status', () => {
      const myDriverId = 'driver-uuid-123';
      const ctx = createMockContext(
        { role: UserRole.DRIVER, driverId: myDriverId },
        myDriverId,
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('prevents Driver A from tampering with Driver B records (throws ForbiddenException)', () => {
      const driverAId = 'driver-uuid-aaa';
      const driverBId = 'driver-uuid-bbb';

      const ctx = createMockContext(
        { role: UserRole.DRIVER, driverId: driverAId },
        driverBId,
      );

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});
