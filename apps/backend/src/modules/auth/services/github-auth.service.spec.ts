import { GithubAuthService } from './github-auth.service';
import { GithubOAuthProvider } from '../providers/github/github-oauth.provider';
import { OAuthAccountService } from './oauth-account.service';
import { AuthService } from './auth.service';
import { UsersService } from '../../users/services/users.service';
import { PasswordService } from '../../../common/security/password/password.service';
import { PrismaService } from '../../../database/prisma.service';

describe('GithubAuthService', () => {
  let service: GithubAuthService;
  let provider: GithubOAuthProvider;
  const redisState = new Map<string, string>();
  const redis = {
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

  beforeEach(() => {
    jest.clearAllMocks();
    redisState.clear();
    provider = new GithubOAuthProvider();
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    service = new GithubAuthService(
      provider,
      {} as OAuthAccountService,
      {} as AuthService,
      {} as UsersService,
      {} as PasswordService,
      {} as PrismaService,
      redis as any,
    );
  });

  it('throws error on getLoginUrl when env is unconfigured', async () => {
    await expect(service.getLoginUrl()).rejects.toThrow(
      'GitHub OAuth is not configured yet.',
    );
  });

  it('generates login URL when configured', async () => {
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';

    const url = await service.getLoginUrl();
    expect(url).toContain('https://github.com/login/oauth/authorize');
    expect(url).toContain('client_id=test-client-id');
  });

  it('rejects unregistered native OAuth callback URLs', async () => {
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';

    await expect(
      service.getLoginUrl('https://attacker.example/callback'),
    ).rejects.toThrow('The native OAuth redirect URI is not allowed.');
  });

  it('keeps the registered native callback through the OAuth state round trip', async () => {
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';

    const url = await service.getLoginUrl('neraca://auth/callback');
    const state = new URL(url).searchParams.get('state');

    await expect(service.getCallbackFailureRedirectUrl(state ?? undefined)).resolves.toBe(
      'neraca://auth/callback?oauth_error=github_auth_failed',
    );
  });

  it('returns an intentional cancellation to the registered native callback', async () => {
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';

    const url = await service.getLoginUrl('neraca://auth/callback');
    const state = new URL(url).searchParams.get('state');

    await expect(
      service.getCallbackCancellationRedirectUrl(state ?? undefined),
    ).resolves.toBe('neraca://auth/callback?oauth_cancelled=github');
    expect(redis.del).toHaveBeenCalledWith(`oauth:github:state:${state}`);
  });

  it('persists the GitHub profile name for a new user', async () => {
    const usersService = {
      create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'profile@example.com',
        full_name: 'Profile Name',
      }),
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new GithubAuthService(
      provider,
      {} as OAuthAccountService,
      {} as AuthService,
      usersService as unknown as UsersService,
      {} as PasswordService,
      prisma as unknown as PrismaService,
      redis as any,
    );

    await (service as any).createGithubUser({
      email: 'profile@example.com',
      fullName: 'Profile Name',
      avatarUrl: null,
      provider: 'github',
      providerUserId: '67890',
      verifiedEmail: true,
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'profile@example.com',
        full_name: 'Profile Name',
      }),
      { hasManualPassword: false, avatarUrl: null },
    );
  });

  it('preserves a manually edited name for an existing linked account', async () => {
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
    const stateUrl = await service.getLoginUrl();
    const state = new URL(stateUrl).searchParams.get('state');
    const mockedFetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 67890,
          login: 'provider-login',
          name: 'GitHub Provider Name',
          email: 'profile@example.com',
          avatar_url: 'https://github.example/avatar-current.png',
        }),
      });
    (global as any).fetch = mockedFetch;

    const linkedAccountService = {
      findProviderAccount: jest.fn().mockResolvedValue({ user_id: 'user-1' }),
      linkProviderAccount: jest.fn(),
    };
    const linkedUsersService = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'profile@example.com',
        full_name: 'Manual Custom Name',
        avatar_url: 'https://github.example/avatar-old.png',
        status: 'ACTIVE',
        role_code: 'USER',
      }),
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateOAuthAvatar: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'profile@example.com',
        full_name: 'Manual Custom Name',
        avatar_url: 'https://github.example/avatar-current.png',
        status: 'ACTIVE',
        role_code: 'USER',
      }),
    };
    const linkedAuthService = {
      issueSessionForUser: jest.fn().mockResolvedValue({
        data: { accessToken: 'token', refreshToken: 'refresh' },
      }),
    };
    service = new GithubAuthService(
      provider,
      linkedAccountService as unknown as OAuthAccountService,
      linkedAuthService as unknown as AuthService,
      linkedUsersService as unknown as UsersService,
      {} as PasswordService,
      {} as PrismaService,
      redis as any,
    );

    const result = await service.handleGithubCallback({
      code: 'code',
      state: state ?? undefined,
    });

    expect(result.success).toBe(true);
    expect(new URL(result.redirectUrl).searchParams.get('userName')).toBe(
      'Manual Custom Name',
    );
    expect(linkedUsersService.create).not.toHaveBeenCalled();
    expect(linkedUsersService.updateOAuthAvatar).toHaveBeenCalledWith(
      'user-1',
      'https://github.example/avatar-current.png',
    );
    expect(linkedAuthService.issueSessionForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Manual Custom Name',
        avatar_url: 'https://github.example/avatar-current.png',
      }),
      'github',
      undefined,
    );
  });
});
