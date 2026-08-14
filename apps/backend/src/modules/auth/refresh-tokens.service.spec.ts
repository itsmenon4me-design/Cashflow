import { RefreshTokensService } from './services/refresh-tokens.service';
import { JwtService } from '@nestjs/jwt';
import { JwtConfigService } from '../../config/jwt-config.service';
import { PasswordService } from '../../common/security/password/password.service';
import { PrismaRefreshTokenRepository } from './repositories/prisma-refresh-token.repository';
import { UsersService } from '../users/services/users.service';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { SessionService } from './services/session.service';
import { AuditLogService } from '../audit-logs/services/audit-log.service';

describe('RefreshTokensService (unit)', () => {
  const now = Date.now();
  const mockJwtService = {
    sign: jest.fn(() => 'newAccess'),
    verify: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;
  const mockJwtConfig = {
    config: {
      refreshSecret: 'rsecret',
      refreshExpiresIn: '7d',
      accessExpiresIn: '15m',
      accessSecret: 'asecret',
    },
  } as unknown as jest.Mocked<JwtConfigService>;
  const mockPasswordService = {
    hashPassword: jest.fn(() => Promise.resolve('hashed')),
    verifyPassword: jest.fn(),
  } as unknown as jest.Mocked<PasswordService>;
  const mockRepo = {
    findById: jest.fn(),
    revoke: jest.fn(() => Promise.resolve()),
    create: jest.fn(() =>
      Promise.resolve(undefined as unknown as RefreshTokenEntity),
    ),
    revokeAllForUser: jest.fn(() => Promise.resolve()),
  } as unknown as jest.Mocked<PrismaRefreshTokenRepository>;
  const mockUsersService = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;
  const mockSessionService = {
    updateLastActivity: jest.fn(() => Promise.resolve()),
    updateRefreshToken: jest.fn(() => Promise.resolve()),
  } as unknown as jest.Mocked<SessionService>;
  const mockAudit = {
    record: jest.fn(() => Promise.resolve()),
  } as unknown as jest.Mocked<AuditLogService>;

  let svc: RefreshTokensService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new RefreshTokensService(
      mockJwtService,
      mockJwtConfig,
      mockPasswordService,
      mockRepo,
      mockUsersService,
      mockSessionService,
      mockAudit,
    );
  });

  it('rotates a valid refresh token successfully', async () => {
    // Arrange: jwt verify returns payload, repo has matching stored token and verifyPassword succeeds
    const payload = { jti: 'oldjti', sub: 'u1', sessionId: 'sess1' };
    mockJwtService.verify.mockReturnValue(payload);

    const stored = {
      id: 'oldjti',
      user_id: 'u1',
      token_hash: 'hash',
      expires_at: new Date(now + 10000),
      revoked_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as RefreshTokenEntity;
    mockRepo.findById.mockResolvedValue(stored);
    mockPasswordService.verifyPassword.mockResolvedValue(true);
    mockPasswordService.hashPassword.mockResolvedValue('newhash');
    mockUsersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'u1@example.com',
      role_code: 'USER',
      created_at: new Date(),
      updated_at: new Date(),
      username: 'user1',
      full_name: 'User One',
      password_hash: 'x',
      status: 'ACTIVE',
    });
    mockJwtService.sign
      .mockReturnValueOnce('newAccessToken')
      .mockReturnValueOnce('newRefreshToken');

    // Act
    const res = await svc.rotate('someRawRefreshToken');

    // Assert
    expect(
      (mockRepo as unknown as { findById: jest.Mock }).findById,
    ).toHaveBeenCalledWith('oldjti');
    expect(
      (mockRepo as unknown as { revoke: jest.Mock }).revoke,
    ).toHaveBeenCalledWith('oldjti');
    expect(
      (mockRepo as unknown as { create: jest.Mock }).create,
    ).toHaveBeenCalled();
    expect(
      (mockUsersService as unknown as { findById: jest.Mock }).findById,
    ).toHaveBeenCalledWith('u1');
    expect(res).toBeDefined();
    expect(res.success).toBe(true);
    expect(res.data.accessToken).toBeDefined();
    expect(res.data.refreshToken).toBeDefined();
  });

  it('detects revoked token reuse and revokes all tokens', async () => {
    const payload = { jti: 'oldjti', sub: 'u2' };
    mockJwtService.verify.mockReturnValue(payload);
    const stored = {
      id: 'oldjti',
      user_id: 'u2',
      token_hash: 'hash',
      revoked_at: new Date(),
      expires_at: new Date(now + 10000),
      created_at: new Date(),
      updated_at: new Date(),
    } as RefreshTokenEntity;
    mockRepo.findById.mockResolvedValue(stored);

    await expect(svc.rotate('token')).rejects.toBeDefined();
    expect(
      (mockRepo as unknown as { revokeAllForUser: jest.Mock }).revokeAllForUser,
    ).toHaveBeenCalledWith('u2');
  });

  it('rejects expired refresh token', async () => {
    const payload = { jti: 'jtiexp', sub: 'u3' };
    mockJwtService.verify.mockReturnValue(payload);
    const stored = {
      id: 'jtiexp',
      user_id: 'u3',
      token_hash: 'hash',
      revoked_at: null,
      expires_at: new Date(now - 10000),
      created_at: new Date(),
      updated_at: new Date(),
    } as RefreshTokenEntity;
    mockRepo.findById.mockResolvedValue(stored);

    await expect(svc.rotate('token')).rejects.toBeDefined();
  });

  it('rejects invalid signature', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });
    await expect(svc.rotate('badtoken')).rejects.toBeDefined();
  });

  it('rejects on hash mismatch', async () => {
    const payload = { jti: 'oldjti', sub: 'u4' };
    mockJwtService.verify.mockReturnValue(payload);
    const stored = {
      id: 'oldjti',
      user_id: 'u4',
      token_hash: 'h',
      expires_at: new Date(now + 10000),
      revoked_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as RefreshTokenEntity;
    mockRepo.findById.mockResolvedValue(stored);
    mockPasswordService.verifyPassword.mockResolvedValue(false);

    await expect(svc.rotate('token')).rejects.toBeDefined();
  });
});
