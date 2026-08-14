import { ExecutionContext } from '@nestjs/common';
import { AdminAuditRateLimitGuard } from './admin-audit-rate-limit.guard';
import { RedisService } from '../../../redis/redis.service';
import { SecurityConfigService } from '../../../config/security-config.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { ErrorCode } from '../../../common/errors/error-codes';

describe('AdminAuditRateLimitGuard', () => {
  let redisMock: { incr: jest.Mock };
  let loggerMock: { securityLog: jest.Mock };
  let guard: AdminAuditRateLimitGuard;

  const configMock = {
    config: {
      adminAuditRateLimit: { ttlSeconds: 60, limit: 5 },
    },
  } as unknown as SecurityConfigService;

  const ctx = (overrides: Record<string, unknown> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 'admin-1' },
          path: '/audit-logs',
          ...overrides,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    redisMock = { incr: jest.fn() };
    loggerMock = { securityLog: jest.fn() };
    guard = new AdminAuditRateLimitGuard(
      redisMock as unknown as RedisService,
      configMock,
      loggerMock as unknown as LoggerService,
    );
  });

  it('allows requests below the limit', async () => {
    redisMock.incr.mockResolvedValue(3);
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });

  it('rejects requests beyond the limit with the standard RATE_LIMIT error', async () => {
    redisMock.incr.mockResolvedValue(6);
    await expect(guard.canActivate(ctx())).rejects.toMatchObject({
      errorCode: ErrorCode.RATE_LIMIT,
      statusCode: 429,
    });
    expect(loggerMock.securityLog).toHaveBeenCalledWith('rate_limit_exceeded', {
      endpoint: '/audit-logs',
      result: 'rejected',
    });
  });

  it('rejects exactly at limit (count > limit)', async () => {
    redisMock.incr.mockResolvedValue(5);
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
    redisMock.incr.mockResolvedValue(6);
    await expect(guard.canActivate(ctx())).rejects.toMatchObject({
      errorCode: ErrorCode.RATE_LIMIT,
    });
  });

  it('keys by authenticated admin identity and path, avoiding ?userId bypass', async () => {
    redisMock.incr.mockResolvedValue(1);
    await guard.canActivate(
      ctx({ path: '/audit-logs', query: { userId: 'victim-user' } }),
    );
    const key = (redisMock.incr.mock.calls[0] as unknown[])[0] as string;
    expect(key).toContain('admin-1');
    expect(key).toContain('/audit-logs');
    expect(key).not.toContain('victim-user');
  });

  it('uses distinct keys per admin identity', async () => {
    redisMock.incr.mockResolvedValue(1);
    await guard.canActivate(ctx());
    await guard.canActivate(ctx({ user: { sub: 'admin-2' } }));
    const keyA = (redisMock.incr.mock.calls[0] as unknown[])[0] as string;
    const keyB = (redisMock.incr.mock.calls[1] as unknown[])[0] as string;
    expect(keyA).toContain('admin-1');
    expect(keyB).toContain('admin-2');
    expect(keyA).not.toBe(keyB);
  });

  it('passes the configured TTL to Redis', async () => {
    redisMock.incr.mockResolvedValue(1);
    await guard.canActivate(ctx());
    expect(redisMock.incr).toHaveBeenCalledWith(expect.any(String), 60);
  });

  it('fails open when Redis is unavailable', async () => {
    redisMock.incr.mockResolvedValue(null);
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });

  it('fails open when Redis throws and never leaks internals', async () => {
    redisMock.incr.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
    expect(loggerMock.securityLog).toHaveBeenCalledWith(
      'rate_limit_redis_error',
      expect.any(Object),
    );
  });

  it('does not key or limit anonymous requests', async () => {
    await expect(
      guard.canActivate(ctx({ user: { sub: undefined } })),
    ).resolves.toBe(true);
    expect(redisMock.incr).not.toHaveBeenCalled();
  });
});
