import { RefreshTokensService } from './refresh-tokens.service';
import { ErrorCode } from '../../../common/errors/error-codes';

const makeMocks = () => {
  const jwtService = { verify: jest.fn(), sign: jest.fn(() => 'newRT') } as any;
  const jwtConfig = {
    config: {
      refreshSecret: 's',
      refreshExpiresIn: '7d',
      accessExpiresIn: '15m',
    },
  } as any;
  const passwordService = {
    verifyPassword: jest.fn(),
    hashPassword: jest.fn(async (t: string) => 'hashed-' + t),
  } as any;
  const repo = {
    findById: jest.fn(),
    revokeAllForUser: jest.fn(),
    revoke: jest.fn(),
    create: jest.fn(),
  } as any;
  const usersService = { findById: jest.fn() } as any;
  const sessionService = {
    updateLastActivity: jest.fn(),
    updateRefreshToken: jest.fn(),
  } as any;
  const auditLogService = { record: jest.fn() } as any;
  const logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() } as any;

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
      logger,
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
    };
    repo.findById.mockResolvedValue(stored);
    passwordService.verifyPassword.mockResolvedValue(true);
    repo.revoke.mockResolvedValue(true);
    repo.create.mockResolvedValue(true);
    usersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role_code: 'USER',
    });

    const res = await svc.rotate('someToken');
    expect(res.success).toBe(true);
    expect(repo.revoke).toHaveBeenCalledWith('oldjti');
    expect(repo.create).toHaveBeenCalled();
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
      logger,
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
      revoked_at: new Date(),
      expires_at: new Date(Date.now() + 10000),
    });

    await expect(svc.rotate('t')).rejects.toMatchObject({
      errorCode: ErrorCode.UNAUTHORIZED,
    });
    expect(repo.revokeAllForUser).toHaveBeenCalledWith('u1');
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
      logger,
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
      revoked_at: null,
      expires_at: new Date(Date.now() - 1000),
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
      logger,
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
      logger,
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
    };
    repo.findById.mockResolvedValue(stored);
    passwordService.verifyPassword.mockResolvedValue(true);
    repo.revoke.mockResolvedValue(true);
    usersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role_code: 'USER',
    });
    // Make updateLastActivity throw
    sessionService.updateLastActivity.mockImplementation(() => {
      throw new Error('db fail');
    });
    // rotate should still succeed
    const res = await svc.rotate('t');
    expect(res.success).toBe(true);
    // session update attempted
    expect(sessionService.updateLastActivity).toHaveBeenCalledWith('sess');
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
      logger,
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
