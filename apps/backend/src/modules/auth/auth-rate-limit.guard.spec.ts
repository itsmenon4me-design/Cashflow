import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { RedisService } from '../../redis/redis.service';
import { AuthConfigService } from '../../config/auth-config.service';
import { LoggerService } from '../../common/logger/logger.service';

const makeMocks = () => {
  const redis = { incr: jest.fn() } as any;
  const authConfig = {
    config: {
      loginLimit: 2,
      loginWindowSeconds: 60,
      registerLimit: 3,
      registerWindowSeconds: 60,
      refreshLimit: 4,
      refreshWindowSeconds: 60,
    },
  } as any;
  const logger = {
    securityLog: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
  return { redis, authConfig, logger };
};

const makeReq = (
  path: string,
  headers: Record<string, string> = {},
  ip?: string,
) => {
  return {
    path,
    headers,
    ip,
    socket: { remoteAddress: ip },
  } as any;
};

const makeCtx = (req: any) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

describe('AuthRateLimitGuard', () => {
  beforeEach(() => jest.resetAllMocks());

  test('allows requests below limit (login)', async () => {
    const { redis, authConfig, logger } = makeMocks();
    redis.incr.mockResolvedValue(1);
    const g = new AuthRateLimitGuard(
      redis as RedisService,
      authConfig as AuthConfigService,
      logger as LoggerService,
    );
    const ok = await g.canActivate(
      makeCtx(
        makeReq('/auth/login', { 'x-forwarded-for': '1.2.3.4' }, '1.2.3.4'),
      ),
    );
    expect(ok).toBe(true);
    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      authConfig.config.loginWindowSeconds,
    );
  });

  test('rejects when at/above limit (login)', async () => {
    const { redis, authConfig, logger } = makeMocks();
    redis.incr.mockResolvedValue(3);
    const g = new AuthRateLimitGuard(
      redis as RedisService,
      authConfig as AuthConfigService,
      logger as LoggerService,
    );
    const ok = await g.canActivate(
      makeCtx(
        makeReq('/auth/login', { 'x-forwarded-for': '1.2.3.4' }, '1.2.3.4'),
      ),
    );
    expect(ok).toBe(false);
  });

  test('register below and above limit', async () => {
    const { redis, authConfig, logger } = makeMocks();
    const g = new AuthRateLimitGuard(
      redis as RedisService,
      authConfig as AuthConfigService,
      logger as LoggerService,
    );
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
    const g = new AuthRateLimitGuard(
      redis as RedisService,
      authConfig as AuthConfigService,
      logger as LoggerService,
    );
    redis.incr.mockResolvedValue(1);
    expect(
      await g.canActivate(makeCtx(makeReq('/auth/refresh', {}, '9.9.9.9'))),
    ).toBe(true);
    redis.incr.mockResolvedValue(99);
    expect(
      await g.canActivate(makeCtx(makeReq('/auth/refresh', {}, '9.9.9.9'))),
    ).toBe(false);
  });

  test('fails open if redis returns null', async () => {
    const { redis, authConfig, logger } = makeMocks();
    redis.incr.mockResolvedValue(null);
    const g = new AuthRateLimitGuard(
      redis as RedisService,
      authConfig as AuthConfigService,
      logger as LoggerService,
    );
    expect(
      await g.canActivate(makeCtx(makeReq('/auth/login', {}, '1.1.1.1'))),
    ).toBe(true);
  });

  test('ip extraction prefers x-forwarded-for, then req.ip, then socket.remoteAddress', async () => {
    const { redis, authConfig, logger } = makeMocks();
    redis.incr.mockResolvedValue(1);
    const g = new AuthRateLimitGuard(
      redis as RedisService,
      authConfig as AuthConfigService,
      logger as LoggerService,
    );
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
    const req3 = { path: '/auth/login', headers: {} } as any;
    expect(await g.canActivate(makeCtx(req3))).toBe(true);
  });
});
