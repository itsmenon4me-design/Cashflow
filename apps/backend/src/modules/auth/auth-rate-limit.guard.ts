import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { AuthConfigService } from '../../config/auth-config.service';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Simple endpoint-level rate limiter for authentication endpoints.
 * - Enforces per-IP limits for login/register/refresh and email verification send/resend.
 * - Uses Redis if available; if Redis is unavailable, the guard fails-open (allows requests) to avoid taking auth offline.
 */

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AuthRateLimitGuard.name);

  constructor(
    private readonly redis: RedisService,
    private readonly authConfig: AuthConfigService,
    private readonly appLogger: LoggerService,
  ) {}

  private getClientIp(req: Request): string {
    const xf = req.headers['x-forwarded-for'] as string | undefined;
    if (xf) {
      // take first IP in list
      return xf.split(',')[0].trim();
    }
    // express sets req.ip if trust proxy configured; fallback to socket
    return (
      (req.ip as string) ||
      (req.socket && (req.socket.remoteAddress as string)) ||
      'unknown'
    );
  }

  private async incrIp(key: string, ttl: number): Promise<number | null> {
    try {
      return await this.redis.incr(key, ttl);
    } catch {
      this.logger.warn(
        'Redis INCR failed in rate limiter; allowing request (fail-open)',
      );
      this.appLogger.securityLog('rate_limit_redis_error', {
        endpointKey: key,
      });
      return null;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(req);
    const path = req.path || '';

    const cfg = this.authConfig.config;

    let limit = cfg.loginLimit;
    let windowSec = cfg.loginWindowSeconds;

    if (path.endsWith('/login')) {
      limit = cfg.loginLimit;
      windowSec = cfg.loginWindowSeconds;
    } else if (path.endsWith('/register')) {
      limit = cfg.registerLimit;
      windowSec = cfg.registerWindowSeconds;
    } else if (path.endsWith('/refresh')) {
      limit = cfg.refreshLimit;
      windowSec = cfg.refreshWindowSeconds;
    } else if (
      path.endsWith('/send-verification') ||
      path.endsWith('/resend')
    ) {
      limit = cfg.emailVerificationLimit;
      windowSec = cfg.emailVerificationWindowSeconds;
    } else {
      return true;
    }

    const key = `rate:auth:ip:${path}:${ip}`;
    const count = await this.incrIp(key, windowSec);
    if (count === null) {
      // Redis unavailable — fail-open to avoid outage
      return true;
    }

    if (count > limit) {
      // Structured security log (no secrets)
      this.appLogger.securityLog('rate_limit_exceeded', {
        endpoint: path,
        result: 'rejected',
      });
      return false;
    }

    return true;
  }
}
