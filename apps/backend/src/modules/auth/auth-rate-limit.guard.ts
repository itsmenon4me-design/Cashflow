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
 * - Uses Redis when available; if Redis is unavailable, the guard fails closed by default
 *   to prevent brute-force attacks against sensitive auth endpoints.
 * - A dedicated env flag can opt into fail-open only for controlled low-risk environments.
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
    } else if (
      path.endsWith('/forgot-password') ||
      path.endsWith('/reset-password')
    ) {
      limit = cfg.resetPasswordLimit;
      windowSec = cfg.resetPasswordWindowSeconds;
    } else {
      return true;
    }

    const key = `rate:auth:ip:${path}:${ip}`;
    const count = await this.incrIp(key, windowSec);
    if (count === null) {
      const failOpen = cfg.failOpenOnRedisError === true;
      const status = failOpen ? 'allowing request (fail-open)' : 'rejecting request (fail-closed)';
      this.logger.warn(
        `Redis unavailable in auth rate limiter; ${status} endpoint=${path} ip=${ip} key=${key}`,
      );
      this.appLogger.securityLog('rate_limit_redis_error', {
        endpoint: path,
        clientIp: ip,
        endpointKey: key,
        failOpen,
      });
      return failOpen;
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
