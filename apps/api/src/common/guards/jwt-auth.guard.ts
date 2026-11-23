import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '@fleet-pulse/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    const secret =
      this.configService.get<string>('JWT_SECRET') ||
      'fleetpulse-dev-jwt-access-secret-minimum-32-chars-long';

    try {
      const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
      request.user = {
        sub: (decoded.sub || decoded.id) as string,
        email: decoded.email as string,
        role: decoded.role,
        driverId: decoded.driverId || null,
      } as JwtPayload;
      return true;
    } catch (err) {
      throw new UnauthorizedException(
        `Invalid or expired authorization token: ${(err as Error).message}`,
      );
    }
  }
}
