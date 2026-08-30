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
});
