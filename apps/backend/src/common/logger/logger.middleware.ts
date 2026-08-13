import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { LoggerService } from './logger.service';
import {
  CORRELATION_ID_HEADER,
  REQUEST_LOG_WHITELIST,
} from './logger.constants';

interface ExtendedRequest extends Request {
  correlationId?: string;
  requestId?: string;
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  private normalizeRequestId(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(trimmed)) {
      return undefined;
    }
    return trimmed;
  }

  use(req: ExtendedRequest, res: Response, next: NextFunction): void {
    // Skip some paths
    if (REQUEST_LOG_WHITELIST.includes(req.path)) return next();

    const correlationHeader = req.headers[CORRELATION_ID_HEADER];
    const correlationId =
      this.normalizeRequestId(correlationHeader) ?? randomUUID();
    const requestIdHeader = req.headers['x-request-id'];
    const requestId = this.normalizeRequestId(requestIdHeader) ?? randomUUID();

    // attach to request and response headers
    req.correlationId = correlationId;
    req.requestId = requestId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    res.setHeader('x-request-id', requestId);

    // log request arrival
    const ip =
      req.ip ||
      (req.headers['x-forwarded-for'] as string) ||
      req.socket?.remoteAddress;
    const userAgent = req.get('user-agent') || undefined;

    this.logger.requestLog({
      method: req.method,
      url: req.originalUrl || req.url,
      ip: ip,
      userAgent,
      correlationId,
      requestId,
    });

    // measure response time
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      const statusCode = res.statusCode;
      const headerContentLength = res.getHeader('content-length');
      const payloadSize =
        typeof headerContentLength === 'string'
          ? Number(headerContentLength)
          : typeof headerContentLength === 'number'
            ? headerContentLength
            : 0;
      this.logger.responseLog(
        {
          statusCode,
          responseTimeMs: Math.round(durationMs),
          payloadSizeBytes: payloadSize,
          correlationId,
        },
        'HTTP',
      );
    });

    next();
  }
}
