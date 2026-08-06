import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import type { Request } from 'express';
import { AuditLogService } from '../../modules/audit-logs/services/audit-log.service';
import { AUDIT_METADATA_KEY, AuditMetadata } from './audit.decorator';

interface ExtendedRequest extends Request {
  user?: {
    sub?: string;
    [key: string]: unknown;
  };
}

/**
 * Automatically captures request information for routes marked with @Audit.
 *
 * Audit recording is best-effort: a storage failure must never affect the
 * main request. The AuditLogService never throws, so this interceptor is
 * transparent to the request lifecycle.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!auditMeta) return next.handle();

    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    return next.handle().pipe(
      tap(() => {
        this.record(request, auditMeta, this.resolveStatus(context, null));
      }),
      catchError((error: unknown) => {
        this.record(request, auditMeta, this.resolveStatus(context, error));
        return throwError(() => error);
      }),
    );
  }

  private resolveStatus(context: ExecutionContext, error: unknown): number {
    if (error instanceof HttpException) return error.getStatus();
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const status = (error as { statusCode?: unknown }).statusCode;
      if (typeof status === 'number') return status;
    }
    if (error) return 500;
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode?: number }>();
    return response?.statusCode ?? 200;
  }

  private record(
    request: ExtendedRequest,
    meta: AuditMetadata,
    status: number,
  ): void {
    const entityId =
      typeof request.params?.id === 'string' ? request.params.id : null;
    const headers = request.headers as Record<string, unknown> | undefined;
    const ip =
      request.ip ||
      (headers && (headers['x-forwarded-for'] as string | undefined)) ||
      request.socket?.remoteAddress ||
      null;
    const userAgent = request.get?.('user-agent') || null;

    void this.auditLogService.record({
      userId: request.user?.sub ?? null,
      action: meta.action,
      module: meta.module,
      entityType: meta.entityType ?? null,
      entityId,
      ipAddress: ip,
      userAgent,
      requestMethod: request.method,
      requestPath: request.originalUrl || request.url,
      responseStatus: status,
    });
  }
}
