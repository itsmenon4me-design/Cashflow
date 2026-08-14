import { AuthService } from './auth.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { UsersService } from '../../users/services/users.service';
import { PasswordService } from '../../../common/security/password/password.service';
import { JwtService } from '@nestjs/jwt';
import { JwtConfigService } from '../../../config/jwt-config.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { SessionService } from './session.service';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { AuthConfigService } from '../../../config/auth-config.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { RedisService } from '../../../redis/redis.service';

// Minimal mocks for dependent services
const makeMocks = () => {
  const users = {
    findByEmail: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;
  const passwordService = {
    verifyPassword: jest.fn(),
  } as unknown as jest.Mocked<PasswordService>;
  const jwtService = {
    sign: jest.fn(() => 'token'),
  } as unknown as jest.Mocked<JwtService>;
  const jwtConfig = {
    config: { accessExpiresIn: '15m' },
  } as unknown as jest.Mocked<JwtConfigService>;
  const refreshService = {
    createForUser: jest.fn(() => ({
      id: 'r1',
      token: 'rt',
      expires_at: new Date(Date.now() + 1000),
    })),
  } as unknown as jest.Mocked<RefreshTokensService>;
  const authConfig = {
    config: {
      failLimit: 10,
      failWindowSeconds: 3600,
      loginLimit: 5,
      loginWindowSeconds: 60,
      registerLimit: 10,
      registerWindowSeconds: 60,
      refreshLimit: 30,
      refreshWindowSeconds: 60,
    },
  } as unknown as jest.Mocked<AuthConfigService>;
  const appLogger = {
    securityLog: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
  const sessionService = {
    create: jest.fn(),
  } as unknown as jest.Mocked<SessionService>;
  const auditLogService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditLogService>;
  const redis = {
    incr: jest.fn(),
    del: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  return {
    users,
    passwordService,
    jwtService,
    jwtConfig,
    refreshService,
    sessionService,
    auditLogService,
    redis,
    authConfig,
    appLogger,
  };
};

describe('AuthService (rate-limit failures)', () => {
  beforeEach(() => jest.resetAllMocks());

  test('successful login clears failure counter and returns tokens', async () => {
    const {
      users,
      passwordService,
      jwtService,
      jwtConfig,
      refreshService,
      sessionService,
      auditLogService,
      redis,
      authConfig,
      appLogger,
    } = makeMocks();
    users.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password_hash: 'h',
      role_code: 'USER',
      username: 'user1',
      full_name: 'User One',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: null,
    });
    passwordService.verifyPassword.mockResolvedValue(true);
    redis.del.mockResolvedValue(1);

    const svc = new AuthService(
      users,
      passwordService,
      jwtService,
      jwtConfig,
      refreshService,
      sessionService,
      auditLogService,
      redis,
      authConfig,
      appLogger,
    );

    const res = await svc.login({ email: 'a@b.com', password: 'x' });
    expect(res.success).toBe(true);
    expect((redis as unknown as { del: jest.Mock }).del).toHaveBeenCalled();
  });

  test('non-existing user increments failure and may hit rate limit', async () => {
    const {
      users,
      passwordService,
      jwtService,
      jwtConfig,
      refreshService,
      sessionService,
      auditLogService,
      redis,
      authConfig,
      appLogger,
    } = makeMocks();
    users.findByEmail.mockResolvedValue(null);
    // Simulate Redis returning failLimit (10)
    redis.incr.mockResolvedValue(10);

    const svc = new AuthService(
      users,
      passwordService,
      jwtService,
      jwtConfig,
      refreshService,
      sessionService,
      auditLogService,
      redis,
      authConfig,
      appLogger,
    );

    await expect(
      svc.login({ email: 'notfound@example.com', password: 'x' }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.RATE_LIMIT });
  });
});
