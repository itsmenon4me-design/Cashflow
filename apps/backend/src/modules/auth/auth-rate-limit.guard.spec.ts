import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { AuthConfigService } from '../../config/auth-config.service';
import { LoggerService } from '../../common/logger/logger.service';

const makeMocks = () => {
  const redis = {
    incr: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;
  const authConfig = {
    config: {
      loginLimit: 2,
      loginWindowSeconds: 60,
      registerLimit: 3,
      registerWindowSeconds: 60,
      refreshLimit: 4,
      refreshWindowSeconds: 60,
      emailVerificationLimit: 2,
      emailVerificationWindowSeconds: 60,
      resetPasswordLimit: 2,
      resetPasswordWindowSeconds: 60,
    failOpenOnRedisError: false,
  },
  } as unknown as jest.Mocked<AuthConfigService>;
  const logger = {
    securityLog: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
  return { redis, authConfig, logger };
};

const makeReq = (
  path: string,
  headers: Record<string, string> = {},
  ip?: string,
): Request => {
  return {
    path,
    headers,
    ip,
    socket: { remoteAddress: ip },
  } as unknown as Request;
};

const makeCtx = (req: Request): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

describe('AuthRateLimitGuard', () => {
  beforeEach(() => jest.resetAllMocks());

  test('allows requests below limit (login)', async () => {
    const { redis, authConfig, logger } = makeMocks();
    redis.incr.mockResolvedValue(1);
    const g = new AuthRateLimitGuard(redis, authConfig, logger);
    const ok = await g.canActivate(
      makeCtx(
        makeReq('/auth/login', { 'x-forwarded-for': '1.2.3.4' }, '1.2.3.4'),
      ),
    );
    expect(ok).toBe(true);
    expect((redis as unknown as { incr: jest.Mock }).incr).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      authConfig.config.loginWindowSeconds,
    );
  });

  test('rejects when at/above limit (login)', async () => {
    const { redis, authConfig, logger } = makeMocks();
    redis.incr.mockResolvedValue(3);
    const g = new AuthRateLimitGuard(redis, authConfig, logger);
    const ok = await g.canActivate(
      makeCtx(
        makeReq('/auth/login', { 'x-forwarded-for': '1.2.3.4' }, '1.2.3.4'),
      ),
    );
    expect(ok).toBe(false);
  });

  test('register below and above limit', async () => {
    const { redis, authConfig, logger } = makeMocks();
    const g = new AuthRateLimitGuard(redis, authConfig, logger);
    redis.incr.mockResolvedValue(1);
    expect(
      await g.canActivate(makeCtx(makeReq('/auth/register', {}, '5.6.7.8'))),
    ).toBe(true);
    redis.incr.mockResolvedValue(10);
    expect(
      await g.canActivate(makeCtx(makeReq('/auth/register', {}, '5.6.7.8'))),
    ).toBe(false);
  });

  test('refresh below and above limit', async () => {
    const { redis, authConfig, logger } = makeMocks();
    const g = new AuthRateLimitGuard(redis, authConfig, logger);
    redis.incr.mockResolvedValue(1);
    expect(
      await g.canActivate(makeCtx(makeReq('/auth/refresh', {}, '9.9.9.9'))),
    ).toBe(true);
    redis.incr.mockResolvedValue(99);
    expect(
      await g.canActivate(makeCtx(makeReq('/auth/refresh', {}, '9.9.9.9'))),
    ).toBe(false);
  });

  test('email verification endpoints below and above limit', async () => {
    const { redis, authConfig, logger } = makeMocks();
    const g = new AuthRateLimitGuard(redis, authConfig, logger);
    redis.incr.mockResolvedValue(1);
    expect(
      await g.canActivate(
        makeCtx(makeReq('/auth/email/send-verification', {}, '1.1.1.1')),
      ),
    ).toBe(true);
    expect(
      await g.canActivate(
        makeCtx(makeReq('/auth/email/resend', {}, '1.1.1.1')),
      ),
    ).toBe(true);
    expect((redis as unknown as { incr: jest.Mock }).incr).toHaveBeenCalledWith(
      expect.stringContaining('/auth/email/send-verification'),
      authConfig.config.emailVerificationWindowSeconds,
    );
    expect((redis as unknown as { incr: jest.Mock }).incr).toHaveBeenCalledWith(
      expect.stringContaining('/auth/email/resend'),
      authConfig.config.emailVerificationWindowSeconds,
    );
    redis.incr.mockResolvedValue(3);
    expect(
      await g.canActivate(
        makeCtx(makeReq('/auth/email/send-verification', {}, '1.1.1.1')),
      ),
    ).toBe(false);
    expect(
      await g.canActivate(
        makeCtx(makeReq('/auth/email/resend', {}, '1.1.1.1')),
      ),
    ).toBe(false);
  });

  test('fails closed by default if redis returns null', async () => {
    const { redis, authConfig, logger } = makeMocks();
    redis.incr.mockResolvedValue(null);
    const g = new AuthRateLimitGuard(redis, authConfig, logger);

    const ok = await g.canActivate(
      makeCtx(
        makeReq('/auth/login', { 'x-forwarded-for': '1.2.3.4' }, '1.2.3.4'),
      ),
    );

    expect(ok).toBe(false);
    expect(logger.securityLog).toHaveBeenCalledWith('rate_limit_redis_error', {
      endpoint: '/auth/login',
      clientIp: '1.2.3.4',
      endpointKey: expect.stringContaining('/auth/login:1.2.3.4'),
      failOpen: false,
    });
    expect((redis as unknown as { incr: jest.Mock }).incr).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      authConfig.config.loginWindowSeconds,
    );
  });

  test('fail-open is opt-in via config flag for redis downtime', async () => {
    const { redis, authConfig, logger } = makeMocks();
    authConfig.config.failOpenOnRedisError = true;
    redis.incr.mockResolvedValue(null);
    const g = new AuthRateLimitGuard(redis, authConfig, logger);

    const ok = await g.canActivate(
      makeCtx(
        makeReq('/auth/email/forgot-password', {}, '9.9.9.9'),
      ),
    );

    expect(ok).toBe(true);
    expect(logger.securityLog).toHaveBeenCalledWith('rate_limit_redis_error', {
      endpoint: '/auth/email/forgot-password',
      clientIp: '9.9.9.9',
      endpointKey: expect.stringContaining('/auth/email/forgot-password:9.9.9.9'),
      failOpen: true,
    });
  });

  test('ip extraction prefers x-forwarded-for, then req.ip, then socket.remoteAddress', async () => {
    const { redis, authConfig, logger } = makeMocks();
    redis.incr.mockResolvedValue(1);
    const g = new AuthRateLimitGuard(redis, authConfig, logger);
    // X-Forwarded-For present
    const req1 = makeReq(
      '/auth/login',
      { 'x-forwarded-for': '4.3.2.1, 8.8.8.8' },
      '2.2.2.2',
    );
    expect(await g.canActivate(makeCtx(req1))).toBe(true);
    // req.ip present (simulate by leaving header undefined but setting ip field)
    const req2 = makeReq('/auth/login', {}, '7.7.7.7');
    req2.headers = {};
    expect(await g.canActivate(makeCtx(req2))).toBe(true);
    // no ip fields -> fallback
    const req3 = {
      path: '/auth/login',
      headers: {},
    } as unknown as Request;
    expect(await g.canActivate(makeCtx(req3))).toBe(true);
  });
});
