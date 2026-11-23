import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AdminAudit');

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ip = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
    const method = request.method;
    const url = request.url;
    const startTime = Date.now();

    const auditActionName = action || `ADMIN_${method}_${url}`;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log({
            audit: true,
            action: auditActionName,
            actorId: user?.sub || 'anonymous',
            actorEmail: user?.email || 'unauthenticated',
            actorRole: user?.role || 'unknown',
            target: request.params?.id || null,
            ip,
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            status: 'SUCCESS',
          });
        },
        error: (err) => {
          this.logger.warn({
            audit: true,
            action: auditActionName,
            actorId: user?.sub || 'anonymous',
            actorEmail: user?.email || 'unauthenticated',
            actorRole: user?.role || 'unknown',
            target: request.params?.id || null,
            ip,
            error: err.message,
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            status: 'FAILED',
          });
        },
      }),
    );
  }
}
