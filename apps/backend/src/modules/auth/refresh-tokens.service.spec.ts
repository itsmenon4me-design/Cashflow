import { RefreshTokensService } from './services/refresh-tokens.service';

describe('RefreshTokensService (unit)', () => {
  const now = Date.now();
  const mockJwtService: any = {
    sign: jest.fn().mockReturnValue('newAccess'),
    verify: jest.fn(),
  };
  const mockJwtConfig: any = {
    config: {
      refreshSecret: 'rsecret',
      refreshExpiresIn: '7d',
      accessExpiresIn: '15m',
      accessSecret: 'asecret',
    },
  };
  const mockPasswordService: any = {
    hashPassword: jest.fn().mockResolvedValue('hashed'),
    verifyPassword: jest.fn(),
  };
  const mockRepo: any = {
    findById: jest.fn(),
    revoke: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue(true),
    revokeAllForUser: jest.fn().mockResolvedValue(true),
  };
  const mockUsersService: any = { findById: jest.fn() };
  const mockSessionService: any = {
    updateLastActivity: jest.fn().mockResolvedValue(true),
    updateRefreshToken: jest.fn().mockResolvedValue(true),
  };
  const mockAudit: any = { record: jest.fn().mockResolvedValue(true) };

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
    };
    mockRepo.findById.mockResolvedValue(stored);
    mockPasswordService.verifyPassword.mockResolvedValue(true);
    mockPasswordService.hashPassword.mockResolvedValue('newhash');
    mockUsersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'u1@example.com',
      role_code: 'USER',
    });
    mockJwtService.sign
      .mockReturnValueOnce('newAccessToken')
      .mockReturnValueOnce('newRefreshToken');

    // Act
    const res = await svc.rotate('someRawRefreshToken');

    // Assert
    expect(mockRepo.findById).toHaveBeenCalledWith('oldjti');
    expect(mockRepo.revoke).toHaveBeenCalledWith('oldjti');
    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockUsersService.findById).toHaveBeenCalledWith('u1');
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
      revoked_at: new Date(),
      expires_at: new Date(now + 10000),
    };
    mockRepo.findById.mockResolvedValue(stored);

    await expect(svc.rotate('token')).rejects.toBeDefined();
    expect(mockRepo.revokeAllForUser).toHaveBeenCalledWith('u2');
  });

  it('rejects expired refresh token', async () => {
    const payload = { jti: 'jtiexp', sub: 'u3' };
    mockJwtService.verify.mockReturnValue(payload);
    const stored = {
      id: 'jtiexp',
      user_id: 'u3',
      revoked_at: null,
      expires_at: new Date(now - 10000),
    };
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
    };
    mockRepo.findById.mockResolvedValue(stored);
    mockPasswordService.verifyPassword.mockResolvedValue(false);

    await expect(svc.rotate('token')).rejects.toBeDefined();
  });
});
