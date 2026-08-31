import { GithubOAuthProvider } from './github-oauth.provider';

describe('GithubOAuthProvider', () => {
  let provider: GithubOAuthProvider;

  beforeEach(() => {
    provider = new GithubOAuthProvider();
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
  });

  it('detects unconfigured status', () => {
    const status = provider.getConfigurationStatus();
    expect(status.isConfigured).toBe(false);
  });

  it('validates a complete GitHub profile', () => {
    const validated = provider.validateProviderUser({
      id: 12345,
      login: 'octocat',
      name: 'The Octocat',
      email: 'octocat@github.com',
      avatar_url: 'https://github.com/images/error/octocat_happy.gif',
    });

    expect(validated).toEqual({
      provider: 'github',
      providerUserId: '12345',
      email: 'octocat@github.com',
      fullName: 'The Octocat',
      avatarUrl: 'https://github.com/images/error/octocat_happy.gif',
      verifiedEmail: true,
    });
  });

  it('uses the GitHub profile name before the email local part', () => {
    const provider = new GithubOAuthProvider();
    const validated = provider.validateProviderUser({
      id: 67890,
      login: 'profile-login',
      name: '  Profile Name  ',
      email: 'profile@example.com',
    });

    expect(validated.fullName).toBe('Profile Name');
    expect(validated.fullName).not.toBe('profile');
  });

  it('throws when required fields are missing', () => {
    expect(() =>
      provider.validateProviderUser({
        login: 'octocat',
        email: 'octocat@github.com',
      }),
    ).toThrow('GitHub profile is missing required provider user id.');

    expect(() =>
      provider.validateProviderUser({ id: 12345, login: 'octocat' }),
    ).toThrow('GitHub profile is missing required email address.');
  });
});
