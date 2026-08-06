import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogLevel, LogPayload, LogMeta } from './logger.interfaces';
import { DEFAULT_LOG_LEVEL, LOG_LEVELS } from './logger.constants';

@Injectable()
export class LoggerService {
  private level: LogLevel;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('LOG_LEVEL');
    this.level = (configured as LogLevel) ?? DEFAULT_LOG_LEVEL;
    if (!LOG_LEVELS.includes(this.level)) this.level = DEFAULT_LOG_LEVEL;
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
    return order.indexOf(level) <= order.indexOf(this.level);
  }

  private formatPayload(
    level: LogLevel,
    message: string,
    context?: string,
    meta?: LogMeta,
  ): LogPayload {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      meta,
    };
  }

  private output(payload: LogPayload): void {
    const out = JSON.stringify(payload);
    switch (payload.level) {
      case 'error':
        console.error(out);
        break;
      case 'warn':
        console.warn(out);
        break;
      case 'debug':
        console.debug(out);
        break;
      case 'verbose':
        console.info(out);
        break;
      default:
        console.log(out);
    }
  }

  log(message: string, context?: string, meta?: LogMeta): void {
    if (!this.shouldLog('log')) return;
    const payload = this.formatPayload('log', message, context, meta);
    this.output(payload);
  }

  warn(message: string, context?: string, meta?: LogMeta): void {
    if (!this.shouldLog('warn')) return;
    const payload = this.formatPayload('warn', message, context, meta);
    this.output(payload);
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    meta?: LogMeta,
  ): void {
    if (!this.shouldLog('error')) return;
    const payload = this.formatPayload(
      'error',
      `${message}${trace ? ' - ' + trace : ''}`,
      context,
      meta,
    );
    this.output(payload);
  }

  debug(message: string, context?: string, meta?: LogMeta): void {
    if (!this.shouldLog('debug')) return;
    const payload = this.formatPayload('debug', message, context, meta);
    this.output(payload);
  }

  verbose(message: string, context?: string, meta?: LogMeta): void {
    if (!this.shouldLog('verbose')) return;
    const payload = this.formatPayload('verbose', message, context, meta);
    this.output(payload);
  }

  // Convenience helpers for request/response logging
  requestLog(
    {
      method,
      url,
      ip,
      userAgent,
      correlationId,
    }: {
      method: string;
      url: string;
      ip?: string;
      userAgent?: string;
      correlationId?: string;
    },
    context?: string,
  ): void {
    this.log(`${method} ${url}`, context ?? 'HTTP', {
      method,
      url,
      ip,
      userAgent,
      correlationId,
    });
  }

  responseLog(
    {
      statusCode,
      responseTimeMs,
      payloadSizeBytes,
      correlationId,
    }: {
      statusCode: number;
      responseTimeMs?: number;
      payloadSizeBytes?: number;
      correlationId?: string;
    },
    context?: string,
  ): void {
    this.log(`Response ${statusCode}`, context ?? 'HTTP', {
      statusCode,
      responseTimeMs,
      payloadSizeBytes,
      correlationId,
    });
  }

  // Monitoring placeholders
  captureException(_err: unknown): void {
    // Integrate Sentry/OpenTelemetry here in future
    this.error('Captured exception', (_err as Error)?.stack ?? String(_err));
  }

  // Security log hook (placeholder)
  securityLog(event: string, details?: Record<string, unknown>): void {
    this.log(`Security event: ${event}`, 'SECURITY', { ...details });
  }

  // Database log hook (placeholder)
  dbLog(query: string, params?: unknown): void {
    this.debug(`DB Query: ${query}`, 'DATABASE', { params });
  }
}
