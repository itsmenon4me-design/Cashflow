import { RefreshTokensService } from './refresh-tokens.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { JwtService } from '@nestjs/jwt';
import { JwtConfigService } from '../../../config/jwt-config.service';
import { PasswordService } from '../../../common/security/password/password.service';
import { PrismaRefreshTokenRepository } from '../repositories/prisma-refresh-token.repository';
import { UsersService } from '../../users/services/users.service';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';
import { SessionService } from './session.service';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';

const makeMocks = () => {
  const jwtService = {
    verify: jest.fn(),
    sign: jest.fn(() => 'newRT'),
  } as unknown as jest.Mocked<JwtService>;
  const jwtConfig = {
    config: {
      refreshSecret: 's',
      refreshExpiresIn: '7d',
      accessExpiresIn: '15m',
    },
  } as unknown as jest.Mocked<JwtConfigService>;
  const passwordService = {
    verifyPassword: jest.fn(),
    hashPassword: jest.fn((t: string) => Promise.resolve('hashed-' + t)),
  } as unknown as jest.Mocked<PasswordService>;
  const repo = {
    findById: jest.fn(),
    revokeAllForUser: jest.fn(),
    revoke: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<PrismaRefreshTokenRepository>;
  const usersService = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;
  const sessionService = {
    updateLastActivity: jest.fn(),
    updateRefreshToken: jest.fn(),
  } as unknown as jest.Mocked<SessionService>;
  const auditLogService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditLogService>;
  const logger = {
    warn: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<{
    warn: jest.Mock;
    log: jest.Mock;
    error: jest.Mock;
  }>;

  return {
    jwtService,
    jwtConfig,
    passwordService,
    repo,
    usersService,
    sessionService,
    auditLogService,
    logger,
  };
};

describe('RefreshTokensService.rotate', () => {
  beforeEach(() => jest.resetAllMocks());

  test('valid refresh token rotates successfully', async () => {
    const {
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    } = makeMocks();
    const svc = new RefreshTokensService(
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    );

    // incoming token payload
    const payload = { sub: 'u1', jti: 'oldjti', sessionId: 'sess1' };
    jwtService.verify.mockReturnValue(payload);

    const stored = {
      id: 'oldjti',
      user_id: 'u1',
      token_hash: 'oldhash',
      revoked_at: null,
      expires_at: new Date(Date.now() + 10000),
      created_at: new Date(),
      updated_at: new Date(),
    } as RefreshTokenEntity;
    repo.findById.mockResolvedValue(stored);
    passwordService.verifyPassword.mockResolvedValue(true);
    repo.revoke.mockResolvedValue(undefined);
    repo.create.mockResolvedValue({
      id: 'newjti',
      user_id: 'u1',
      token_hash: 'newhash',
      expires_at: new Date(Date.now() + 10000),
      created_at: new Date(),
      updated_at: new Date(),
    });
    usersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role_code: 'USER',
      created_at: new Date(),
      updated_at: new Date(),
      username: 'user1',
      full_name: 'User One',
      password_hash: 'x',
      status: 'ACTIVE',
    });

    const res = await svc.rotate('someToken');
    expect(res.success).toBe(true);
    expect(
      (repo as unknown as { revoke: jest.Mock }).revoke,
    ).toHaveBeenCalledWith('oldjti');
    expect(
      (repo as unknown as { create: jest.Mock }).create,
    ).toHaveBeenCalled();
  });

  test('revoked token triggers revokeAllForUser and unauthorized', async () => {
    const {
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    } = makeMocks();
    const svc = new RefreshTokensService(
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    );
    jwtService.verify.mockReturnValue({ sub: 'u1', jti: 'x' });
    repo.findById.mockResolvedValue({
      id: 'x',
      user_id: 'u1',
      token_hash: 'revokedhash',
      revoked_at: new Date(),
      expires_at: new Date(Date.now() + 10000),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(svc.rotate('t')).rejects.toMatchObject({
      errorCode: ErrorCode.UNAUTHORIZED,
    });
    expect(
      (repo as unknown as { revokeAllForUser: jest.Mock }).revokeAllForUser,
    ).toHaveBeenCalledWith('u1');
  });

  test('expired token returns TOKEN_EXPIRED', async () => {
    const {
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    } = makeMocks();
    const svc = new RefreshTokensService(
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    );
    jwtService.verify.mockReturnValue({ sub: 'u1', jti: 'x' });
    repo.findById.mockResolvedValue({
      id: 'x',
      user_id: 'u1',
      token_hash: 'h',
      revoked_at: null,
      expires_at: new Date(Date.now() - 1000),
      created_at: new Date(Date.now() - 2000),
      updated_at: new Date(Date.now() - 1500),
    });

    await expect(svc.rotate('t')).rejects.toMatchObject({
      errorCode: ErrorCode.TOKEN_EXPIRED,
    });
  });

  test('hash mismatch returns UNAUTHORIZED', async () => {
    const {
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    } = makeMocks();
    const svc = new RefreshTokensService(
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    );
    jwtService.verify.mockReturnValue({ sub: 'u1', jti: 'x' });
    repo.findById.mockResolvedValue({
      id: 'x',
      user_id: 'u1',
      token_hash: 'h',
      revoked_at: null,
      expires_at: new Date(Date.now() + 10000),
      created_at: new Date(),
      updated_at: new Date(),
    });
    passwordService.verifyPassword.mockResolvedValue(false);

    await expect(svc.rotate('t')).rejects.toMatchObject({
      errorCode: ErrorCode.UNAUTHORIZED,
    });
  });

  test('session update failure is logged but does not expose internal error', async () => {
    const {
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    } = makeMocks();
    const svc = new RefreshTokensService(
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    );
    jwtService.verify.mockReturnValue({
      sub: 'u1',
      jti: 'old',
      sessionId: 'sess',
    });
    const stored = {
      id: 'old',
      user_id: 'u1',
      token_hash: 'oldhash',
      revoked_at: null,
      expires_at: new Date(Date.now() + 10000),
      created_at: new Date(),
      updated_at: new Date(),
    } as RefreshTokenEntity;
    repo.findById.mockResolvedValue(stored);
    passwordService.verifyPassword.mockResolvedValue(true);
    repo.revoke.mockResolvedValue(undefined);
    usersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role_code: 'USER',
      created_at: new Date(),
      updated_at: new Date(),
      username: 'user1',
      full_name: 'User One',
      password_hash: 'x',
      status: 'ACTIVE',
    });
    // Make updateLastActivity throw
    sessionService.updateLastActivity.mockImplementation(() => {
      throw new Error('db fail');
    });
    // rotate should still succeed
    const res = await svc.rotate('t');
    expect(res.success).toBe(true);
    // session update attempted
    expect(
      (sessionService as unknown as { updateLastActivity: jest.Mock })
        .updateLastActivity,
    ).toHaveBeenCalledWith('sess');
  });

  test('invalid signature returns UNAUTHORIZED', async () => {
    const {
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    } = makeMocks();
    const svc = new RefreshTokensService(
      jwtService,
      jwtConfig,
      passwordService,
      repo,
      usersService,
      sessionService,
      auditLogService,
    );
    jwtService.verify.mockImplementation(() => {
      throw new Error('bad sig');
    });
    await expect(svc.rotate('t')).rejects.toMatchObject({
      errorCode: ErrorCode.UNAUTHORIZED,
    });
  });
});
