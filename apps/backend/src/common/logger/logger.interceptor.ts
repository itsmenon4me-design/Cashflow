import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import { CORRELATION_ID_HEADER } from './logger.constants';
import { Request, Response } from 'express';

interface ExtendedRequest extends Request {
  correlationId?: string;
}

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<ExtendedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const headers = req?.headers as Record<string, unknown> | undefined;
    const correlationId =
      (headers && (headers[CORRELATION_ID_HEADER] as string | undefined)) ||
      req?.correlationId;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        const statusCode = res?.statusCode ?? 200;
        const payloadSize = undefined; // placeholder for payload size
        this.logger.responseLog(
          {
            statusCode,
            responseTimeMs: responseTime,
            payloadSizeBytes: payloadSize,
            correlationId,
          },
          'HTTP',
        );
      }),
    );
  }
}
