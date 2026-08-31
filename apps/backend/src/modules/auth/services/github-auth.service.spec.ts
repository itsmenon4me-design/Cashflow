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
  const redis = { set: jest.fn().mockResolvedValue(true), get: jest.fn().mockResolvedValue('state'), del: jest.fn().mockResolvedValue(1) };

  beforeEach(() => {
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
      { hasManualPassword: false },
    );
  });
});
