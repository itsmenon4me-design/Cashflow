import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { AppleAuthService } from './apple-auth.service';

describe('AppleAuthService', () => {
  const originalEnv = { ...process.env };

  const provider: any = {
    getConfigurationStatus: jest.fn(),
    validateProviderUser: jest.fn(),
  };
  const oauthAccountService: any = {
    findProviderAccount: jest.fn(),
    linkProviderAccount: jest.fn(),
  };
  const authService: any = { issueSessionForUser: jest.fn() };
  const usersService: any = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const passwordService: any = { hashPassword: jest.fn() };
  const prisma: any = {
    user: { findUnique: jest.fn(), update: jest.fn() },
  };
  let service: AppleAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.APPLE_CLIENT_ID = 'com.cashflow.app';
    process.env.APPLE_TEAM_ID = 'TEAM123';
    process.env.APPLE_KEY_ID = 'KEY123';
    process.env.APPLE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----`;
    process.env.APPLE_CALLBACK_URL = 'http://localhost:3000/auth/apple/callback';

    provider.getConfigurationStatus.mockReturnValue({
      isConfigured: true,
      clientIdConfigured: true,
      teamIdConfigured: true,
      keyIdConfigured: true,
      privateKeyConfigured: true,
      callbackUrlConfigured: true,
    });
    const mockedFetch: any = jest.fn();
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'id-token' }),
    });
    (global as any).fetch = mockedFetch;

    service = new AppleAuthService(
      provider,
      oauthAccountService,
      authService,
      usersService,
      passwordService,
      prisma,
    );
    jest.spyOn(service as any, 'getAppleClientSecret').mockReturnValue('apple-secret');
  });

  it('builds an Apple authorization URL when configured', () => {
    const url = service.getLoginUrl();

    expect(url).toContain('https://appleid.apple.com/auth/authorize');
    expect(url).toContain('client_id=com.cashflow.app');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fapple%2Fcallback');
    expect(url).toContain('response_type=code');
    expect(url).toContain('state=');
  });

  it('fails safely when Apple configuration is missing', () => {
    provider.getConfigurationStatus.mockReturnValue({
      isConfigured: false,
      clientIdConfigured: false,
      teamIdConfigured: false,
      keyIdConfigured: false,
      privateKeyConfigured: false,
      callbackUrlConfigured: false,
    });

    expect(() => service.getLoginUrl()).toThrow('Apple OAuth is not configured yet');
  });

  it('rejects invalid state on Apple callback', async () => {
    await expect(service.handleAppleCallback({ code: 'apple-code' })).rejects.toMatchObject({
      errorCode: ErrorCode.INVALID_INPUT,
    });
  });

  it('rejects invalid Apple identity tokens and safe errors', async () => {
    const stateUrl = service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');
    jest.spyOn(service as any, 'verifyAppleIdToken').mockRejectedValue(
      ErrorService.create(ErrorCode.INVALID_INPUT, 'Apple identity token is invalid or expired.'),
    );

    await expect(
      service.handleAppleCallback({ code: 'apple-code', state: state ?? undefined }),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.INVALID_INPUT,
    });
  });

  it('logs in an existing Apple-linked account without creating a duplicate user', async () => {
    const stateUrl = service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');

    const verifyMock: any = jest.fn();
    verifyMock.mockResolvedValue({
      sub: 'apple-123',
      email: 'user@example.com',
      email_verified: 'true',
    });
    (service as any).verifyAppleIdToken = verifyMock;
    provider.validateProviderUser.mockReturnValue({
      provider: 'apple',
      providerUserId: 'apple-123',
      email: 'user@example.com',
      fullName: 'User Example',
      avatarUrl: null,
      verifiedEmail: true,
    });
    oauthAccountService.findProviderAccount.mockResolvedValue({ user_id: 'user-1' });
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'User Example',
      status: 'ACTIVE',
      role_code: 'USER',
    });
    authService.issueSessionForUser.mockResolvedValue({
      data: { accessToken: 'token', refreshToken: 'refresh' },
    });

    const result = await service.handleAppleCallback({ code: 'apple-code', state: state ?? undefined });

    expect(result.success).toBe(true);
    expect(result.redirectUrl).toContain('/auth/apple/callback?');
    expect(authService.issueSessionForUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      'apple',
    );
  });

  it('creates a new user and provider account for a first-time Apple login', async () => {
    const stateUrl = service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');

    const verifyMock: any = jest.fn();
    verifyMock.mockResolvedValue({
      sub: 'apple-456',
      email: 'newuser@example.com',
      email_verified: 'true',
    });
    (service as any).verifyAppleIdToken = verifyMock;
    provider.validateProviderUser.mockReturnValue({
      provider: 'apple',
      providerUserId: 'apple-456',
      email: 'newuser@example.com',
      fullName: 'New User',
      avatarUrl: null,
      verifiedEmail: true,
    });
    oauthAccountService.findProviderAccount.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue({
      id: 'user-2',
      email: 'newuser@example.com',
      full_name: 'New User',
      status: 'ACTIVE',
      role_code: 'USER',
    });
    prisma.user.findUnique.mockResolvedValue(null);
    passwordService.hashPassword.mockResolvedValue('hashed-password');
    oauthAccountService.linkProviderAccount.mockResolvedValue({ user_id: 'user-2' });
    authService.issueSessionForUser.mockResolvedValue({
      data: { accessToken: 'new-token', refreshToken: 'new-refresh' },
    });

    const result = await service.handleAppleCallback({ code: 'apple-code', state: state ?? undefined });

    expect(usersService.create).toHaveBeenCalled();
    expect(oauthAccountService.linkProviderAccount).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'apple' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects unverified Apple emails', async () => {
    const stateUrl = service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');

    const verifyMock: any = jest.fn();
    verifyMock.mockResolvedValue({
      sub: 'apple-789',
      email: 'unverified@example.com',
      email_verified: 'false',
    });
    (service as any).verifyAppleIdToken = verifyMock;
    provider.validateProviderUser.mockReturnValue({
      provider: 'apple',
      providerUserId: 'apple-789',
      email: 'unverified@example.com',
      fullName: 'Unverified',
      avatarUrl: null,
      verifiedEmail: false,
    });

    await expect(
      service.handleAppleCallback({ code: 'apple-code', state: state ?? undefined }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_INPUT });
  });

  it('rejects when an Apple provider account already belongs to another user', async () => {
    const stateUrl = service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');

    const verifyMock: any = jest.fn();
    verifyMock.mockResolvedValue({
      sub: 'apple-990',
      email: 'duplicate@example.com',
      email_verified: 'true',
    });
    (service as any).verifyAppleIdToken = verifyMock;
    provider.validateProviderUser.mockReturnValue({
      provider: 'apple',
      providerUserId: 'apple-990',
      email: 'duplicate@example.com',
      fullName: 'Duplicate User',
      avatarUrl: null,
      verifiedEmail: true,
    });
    oauthAccountService.findProviderAccount.mockResolvedValue({ user_id: 'user-99' });
    usersService.findById.mockResolvedValue({
      id: 'user-99',
      email: 'duplicate@example.com',
      full_name: 'Duplicate User',
      status: 'ACTIVE',
      role_code: 'USER',
    });

    const result = await service.handleAppleCallback({ code: 'apple-code', state: state ?? undefined });
    expect(result.success).toBe(true);
  });

  it('rejects silent Apple-email merges when the email already belongs to a password account', async () => {
    const stateUrl = service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');

    const verifyMock: any = jest.fn();
    verifyMock.mockResolvedValue({
      sub: 'apple-001',
      email: 'existing@example.com',
      email_verified: 'true',
    });
    (service as any).verifyAppleIdToken = verifyMock;
    provider.validateProviderUser.mockReturnValue({
      provider: 'apple',
      providerUserId: 'apple-001',
      email: 'existing@example.com',
      fullName: 'Existing User',
      avatarUrl: null,
      verifiedEmail: true,
    });
    oauthAccountService.findProviderAccount.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue({
      id: 'existing-user',
      email: 'existing@example.com',
      full_name: 'Existing User',
      status: 'ACTIVE',
    });

    await expect(
      service.handleAppleCallback({ code: 'apple-code', state: state ?? undefined }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.CONFLICT });
  });
});
