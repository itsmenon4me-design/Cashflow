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
import crypto from 'crypto';

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
    const delMock = (redis as unknown as { del: jest.Mock }).del;
    expect(delMock).toHaveBeenCalled();
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

  test('rejects pending verification with a dedicated error code', async () => {
    const mocks = makeMocks();
    mocks.users.findByEmail.mockResolvedValue({
      id: 'u-pending',
      email: 'pending@example.com',
      password_hash: 'hash',
      status: 'PENDING_VERIFICATION',
    });
    const svc = new AuthService(
      mocks.users,
      mocks.passwordService,
      mocks.jwtService,
      mocks.jwtConfig,
      mocks.refreshService,
      mocks.sessionService,
      mocks.auditLogService,
      mocks.redis,
      mocks.authConfig,
      mocks.appLogger,
    );

    await expect(
      svc.login({ email: 'pending@example.com', password: 'correct' }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.EMAIL_NOT_VERIFIED });
    expect(mocks.passwordService.verifyPassword).not.toHaveBeenCalled();
  });
});

describe('AuthService.resetPassword', () => {
  beforeEach(() => jest.resetAllMocks());

  const buildService = () => {
    const users = {
      findById: jest.fn(),
      applyPasswordReset: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    const passwordService = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
    } as unknown as jest.Mocked<PasswordService>;
    const jwtService = {
      sign: jest.fn(() => 'token'),
    } as unknown as jest.Mocked<JwtService>;
    const jwtConfig = {
      config: { accessExpiresIn: '15m' },
    } as unknown as jest.Mocked<JwtConfigService>;
    const refreshService = {
      createForUser: jest.fn(),
      rotate: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokensService>;
    const sessionService = {
      create: jest.fn(),
      revokeAllExcept: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;
    const auditLogService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;
    const redis = {
      incr: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
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
        emailVerificationLimit: 10,
        emailVerificationWindowSeconds: 60,
        resetPasswordLimit: 5,
        resetPasswordWindowSeconds: 60,
      },
    } as unknown as jest.Mocked<AuthConfigService>;
    const appLogger = {
      securityLog: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

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
    return { svc, users, passwordService, sessionService, auditLogService };
  };

  const VALID_INPUT = {
    token: 'x'.repeat(64),
    id: 'u1',
    new_password: 'NewPassw0rd!123',
  };

  const userWithReset = (overrides: Record<string, unknown> = {}) => ({
    id: 'u1',
    email: 'a@b.com',
    username: 'u1',
    full_name: 'Test User',
    created_at: new Date(),
    updated_at: new Date(),
    status: 'ACTIVE' as const,
    password_hash: 'old-hash',
    password_reset_token_hash: crypto
      .createHash('sha256')
      .update('x'.repeat(64))
      .digest('hex'),
    password_reset_expires_at: new Date(Date.now() + 10 * 60 * 1000),
    password_reset_requested_at: new Date(),
    ...overrides,
  });

  test('valid reset re-hashes password, clears state and revokes sessions', async () => {
    const { svc, users, passwordService, sessionService, auditLogService } =
      buildService();
    users.findById.mockResolvedValue(userWithReset());
    passwordService.hashPassword.mockResolvedValue('new-hash');

    const res = await svc.resetPassword(VALID_INPUT);

    expect(res.success).toBe(true);
    expect(
      (passwordService.hashPassword as unknown as jest.Mock).mock.calls,
    ).toEqual(expect.arrayContaining([[VALID_INPUT.new_password]]));
    expect(
      (users.applyPasswordReset as unknown as jest.Mock).mock.calls,
    ).toEqual(expect.arrayContaining([['u1', 'new-hash']]));
    expect(
      (sessionService.revokeAllExcept as unknown as jest.Mock).mock.calls,
    ).toEqual(expect.arrayContaining([['u1']]));
    expect(
      (auditLogService.record as unknown as jest.Mock).mock.calls.length,
    ).toBeGreaterThan(0);
  });

  test('invalid token is rejected with generic error', async () => {
    const { svc, users, sessionService } = buildService();
    users.findById.mockResolvedValue(
      userWithReset({
        password_reset_token_hash: 'ff'.repeat(32), // different hash
      }),
    );

    await expect(svc.resetPassword(VALID_INPUT)).rejects.toMatchObject({
      errorCode: ErrorCode.INVALID_TOKEN,
    });
    expect(
      (sessionService.revokeAllExcept as unknown as jest.Mock).mock.calls
        .length,
    ).toBe(0);
  });

  test('expired token is rejected', async () => {
    const { svc, users } = buildService();
    users.findById.mockResolvedValue(
      userWithReset({ password_reset_expires_at: new Date(Date.now() - 1000) }),
    );

    await expect(svc.resetPassword(VALID_INPUT)).rejects.toMatchObject({
      errorCode: ErrorCode.INVALID_TOKEN,
    });
  });

  test('missing reset state is rejected', async () => {
    const { svc, users } = buildService();
    users.findById.mockResolvedValue(
      userWithReset({
        password_reset_token_hash: null,
        password_reset_expires_at: null,
      }),
    );

    await expect(svc.resetPassword(VALID_INPUT)).rejects.toMatchObject({
      errorCode: ErrorCode.INVALID_TOKEN,
    });
  });

  test('non-existent user returns generic success (no enumeration)', async () => {
    const { svc, users, sessionService } = buildService();
    users.findById.mockResolvedValue(null);

    const res = await svc.resetPassword(VALID_INPUT);

    expect(res.success).toBe(true);
    expect(
      (sessionService.revokeAllExcept as unknown as jest.Mock).mock.calls
        .length,
    ).toBe(0);
  });

  test('reused token is rejected after first use (state cleared)', async () => {
    const { svc, users, passwordService, sessionService } = buildService();
    users.findById.mockResolvedValueOnce(userWithReset());
    passwordService.hashPassword.mockResolvedValue('new-hash');

    expect((await svc.resetPassword(VALID_INPUT)).success).toBe(true);
    expect(
      (sessionService.revokeAllExcept as unknown as jest.Mock).mock.calls
        .length,
    ).toBe(1);

    // Second call: reset state is now cleared (null) -> rejected
    users.findById.mockResolvedValue(
      userWithReset({
        password_reset_token_hash: null,
        password_reset_expires_at: null,
      }),
    );
    await expect(svc.resetPassword(VALID_INPUT)).rejects.toMatchObject({
      errorCode: ErrorCode.INVALID_TOKEN,
    });
  });
});
