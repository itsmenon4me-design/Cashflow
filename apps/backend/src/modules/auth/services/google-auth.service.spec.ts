import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ErrorCode } from '../../../common/errors/error-codes';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthService', () => {
  const originalEnv = { ...process.env };

  const provider: any = { getConfigurationStatus: jest.fn(), validateProviderUser: jest.fn() };
  const oauthAccountService: any = { findProviderAccount: jest.fn(), linkProviderAccount: jest.fn() };
  const authService: any = { issueSessionForUser: jest.fn() };
  const usersService: any = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateOAuthAvatar: jest.fn(),
  };
  const passwordService: any = { hashPassword: jest.fn() };
  const prisma: any = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const redisState = new Map<string, string>();
  const redis: any = {
    set: jest.fn().mockImplementation(async (key: string, value: string) => {
      redisState.set(key, value);
      return true;
    }),
    get: jest.fn().mockImplementation(async (key: string) => redisState.get(key) ?? null),
    del: jest.fn().mockImplementation(async (key: string) => {
      redisState.delete(key);
      return 1;
    }),
  };
  let service: GoogleAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisState.clear();
    process.env = { ...originalEnv };
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3001/api/v1/auth/google/callback';

    provider.getConfigurationStatus.mockReturnValue({
      isConfigured: true,
      clientIdConfigured: true,
      clientSecretConfigured: true,
      callbackUrlConfigured: true,
    });

    service = new GoogleAuthService(
      provider,
      oauthAccountService,
      authService,
      usersService,
      passwordService,
      prisma,
      redis,
    );
  });

  function mockGoogleTokenExchange() {
    const mockedFetch = jest.fn() as any;
    mockedFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-123',
          email: 'user@example.com',
          name: 'User Example',
          email_verified: true,
          picture: null,
        }),
      });
    (global as any).fetch = mockedFetch;
    return mockedFetch;
  }

  it('returns native OAuth callbacks only for the registered app redirect', async () => {
    const url = await service.getLoginUrl('neraca://auth/callback');
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    const state = new URL(url).searchParams.get('state');
    await expect(service.getCallbackFailureRedirectUrl(state ?? undefined)).resolves.toBe(
      'neraca://auth/callback?oauth_error=google_auth_failed',
    );
    await expect(
      service.getLoginUrl('https://attacker.example/callback'),
    ).rejects.toThrow('The native OAuth redirect URI is not allowed.');
  });

  it('logs only the OAuth callback stage when Google token exchange fails', async () => {
    const stateUrl = await service.getLoginUrl('neraca://auth/callback');
    const state = new URL(stateUrl).searchParams.get('state');
    const loggerSpy = jest.spyOn(Logger.prototype, 'error');
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_grant',
        access_token: 'sensitive-access-token',
      }),
    });

    try {
      await expect(
        service.handleGoogleCallback({ code: 'code-123', state: state ?? undefined }),
      ).rejects.toThrow('Google authentication failed. Please try again.');
      expect(loggerSpy).toHaveBeenCalledWith(
        'Google OAuth callback failed during token_exchange (UPSTREAM_OR_INTERNAL_ERROR).',
      );
      expect(JSON.stringify(loggerSpy.mock.calls)).not.toContain(
        'sensitive-access-token',
      );
    } finally {
      loggerSpy.mockRestore();
    }
  });

  it('returns successful native Google authentication to the Neraca app', async () => {
    const stateUrl = await service.getLoginUrl('neraca://auth/callback');
    const state = new URL(stateUrl).searchParams.get('state');
    mockGoogleTokenExchange();

    provider.validateProviderUser.mockReturnValue({
      provider: 'google',
      providerUserId: 'google-123',
      email: 'user@example.com',
      fullName: 'Google Provider Name',
      avatarUrl: 'https://google.example/avatar-current.png',
      verifiedEmail: true,
    });

    oauthAccountService.findProviderAccount.mockResolvedValue({ user_id: 'user-1' });
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'Manual Custom Name',
      avatar_url: 'https://google.example/avatar-old.png',
      status: 'ACTIVE',
      role_code: 'USER',
    });
    usersService.updateOAuthAvatar.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'Manual Custom Name',
      avatar_url: 'https://google.example/avatar-current.png',
      status: 'ACTIVE',
      role_code: 'USER',
    });
    authService.issueSessionForUser.mockResolvedValue({
      data: { accessToken: 'token', refreshToken: 'refresh' },
    });

    const result = await service.handleGoogleCallback({
      code: 'code-123',
      state: state ?? undefined,
    });

    expect(result.success).toBe(true);
    expect(result.redirectUrl).toContain('neraca://auth/callback?');
    expect(new URL(result.redirectUrl).searchParams.get('accessToken')).toBe('token');
    expect(new URL(result.redirectUrl).searchParams.get('userName')).toBe(
      'Manual Custom Name',
    );
    expect(usersService.updateOAuthAvatar).toHaveBeenCalledWith(
      'user-1',
      'https://google.example/avatar-current.png',
    );
    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ full_name: expect.anything() }),
      }),
    );
    expect(authService.issueSessionForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        avatar_url: 'https://google.example/avatar-current.png',
      }),
      'google',
      undefined,
    );
  });

  it('creates a new user and provider record for a first-time Google login', async () => {
    const stateUrl = await service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');
    const mockedFetch = jest.fn() as any;

    mockedFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-456',
          email: 'newuser@example.com',
          name: 'New User',
          email_verified: true,
          picture: 'https://example.com/avatar.png',
        }),
      });
    (global as any).fetch = mockedFetch;

    provider.validateProviderUser.mockReturnValue({
      provider: 'google',
      providerUserId: 'google-456',
      email: 'newuser@example.com',
      fullName: 'New User',
      avatarUrl: 'https://example.com/avatar.png',
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

    const result = await service.handleGoogleCallback({
      code: 'code-456',
      state: state ?? undefined,
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newuser@example.com',
        full_name: 'New User',
      }),
      {
        hasManualPassword: false,
        avatarUrl: 'https://example.com/avatar.png',
      },
    );
    expect(oauthAccountService.linkProviderAccount).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    );
    expect(result.success).toBe(true);
    expect(result.redirectUrl).toContain('/auth/google/callback?');
  });

  it('rejects unverified Google emails', async () => {
    const stateUrl = await service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');
    mockGoogleTokenExchange();
    provider.validateProviderUser.mockReturnValue({
      provider: 'google',
      providerUserId: 'google-789',
      email: 'unverified@example.com',
      fullName: 'Unverified',
      avatarUrl: null,
      verifiedEmail: false,
    });

    await expect(
      service.handleGoogleCallback({ code: 'code-789', state: state ?? undefined }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_INPUT });
  });

  it('rejects invalid Google callbacks', async () => {
    await expect(
      service.handleGoogleCallback({ code: undefined, state: 'bad-state' }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_INPUT });
  });

  it('rejects when a Google account matches an existing user email without provider linkage', async () => {
    const stateUrl = await service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');
    const mockedFetch = jest.fn() as any;

    mockedFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-999',
          email: 'existing@example.com',
          name: 'Existing User',
          email_verified: true,
          picture: null,
        }),
      });
    (global as any).fetch = mockedFetch;

    provider.validateProviderUser.mockReturnValue({
      provider: 'google',
      providerUserId: 'google-999',
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
      service.handleGoogleCallback({ code: 'code-999', state: state ?? undefined }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.CONFLICT });
  });
});
