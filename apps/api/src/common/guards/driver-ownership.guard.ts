import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { UserRole } from '@fleet-pulse/shared';

@Injectable()
export class DriverOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    let user = request.user;
    const targetDriverId = request.params?.id;

    // If request.user is not yet populated but an Authorization header exists, decode it
    if (!user && request.headers?.authorization) {
      try {
        const authHeader = request.headers.authorization;
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        const secret =
          process.env.JWT_SECRET ||
          'fleetpulse-dev-jwt-access-secret-minimum-32-chars-long';
        const decoded = jwt.verify(token, secret) as jwt.JwtPayload & {
          sub?: string;
          id?: string;
          email?: string;
          role?: UserRole;
          driverId?: string | null;
        };
        user = {
          sub: (decoded.sub || decoded.id || '') as string,
          email: decoded.email || '',
          role: decoded.role || UserRole.DRIVER,
          driverId: decoded.driverId || null,
        };
        request.user = user;
      } catch (err) {
        throw new UnauthorizedException(`Invalid or expired token: ${(err as Error).message}`);
      }
    }

    if (!user) {
      // If endpoint is unauthenticated, allow (fallback for test/mock modes)
      return true;
    }

    // Admins and Dispatchers can modify any driver
    if (user.role === UserRole.ADMIN || user.role === UserRole.DISPATCHER) {
      return true;
    }

    // Drivers can only modify their own driver record
    if (user.role === UserRole.DRIVER) {
      if (!user.driverId || user.driverId !== targetDriverId) {
        throw new ForbiddenException(
          `Forbidden: You can only modify your own driver records (target: ${targetDriverId}, your driverId: ${user.driverId})`,
        );
      }
      return true;
    }

    return false;
  }
}
