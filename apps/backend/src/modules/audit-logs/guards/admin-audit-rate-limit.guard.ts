import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { RedisService } from '../../../redis/redis.service';
import { SecurityConfigService } from '../../../config/security-config.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';

/**
 * Redis-backed rate limiter for the SUPER_ADMIN audit-log read endpoints.
 *
 * Keys by authenticated admin identity (sub) + path. The query string is
 * intentionally excluded from the key, so rotating `?userId=` cannot bypass
 * the limit. Fails open when Redis is unavailable so a Redis outage never
 * takes the audit-log read API offline.
 */
@Injectable()
export class AdminAuditRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuditRateLimitGuard.name);

  constructor(
    private readonly redis: RedisService,
    private readonly securityConfig: SecurityConfigService,
    private readonly appLogger: LoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub?: string } }>();
    const sub = req.user?.sub;
    // Only key by identity when JwtAuthGuard has attached the authenticated admin.
    if (!sub) return true;
    // req.path excludes the query string so userId/page changes cannot reset the counter.
    const key = `rate:audit:admin:${sub}:${req.path || ''}`;

    let count: number | null;
    try {
      count = await this.redis.incr(
        key,
        this.securityConfig.config.adminAuditRateLimit.ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(
        'Redis INCR failed in audit rate limiter; allowing request (fail-open)',
      );
      this.appLogger.securityLog('rate_limit_redis_error', {
        endpointKey: key,
      });
      return true;
    }
    if (count === null) return true;

    if (count > this.securityConfig.config.adminAuditRateLimit.limit) {
      this.appLogger.securityLog('rate_limit_exceeded', {
        endpoint: req.path,
        result: 'rejected',
      });
      throw ErrorService.create(ErrorCode.RATE_LIMIT);
    }

    return true;
  }
}
