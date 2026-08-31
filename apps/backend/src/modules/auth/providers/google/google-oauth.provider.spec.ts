import { GoogleOAuthProvider } from './google-oauth.provider';

describe('GoogleOAuthProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizes a valid Google profile', () => {
    const provider = new GoogleOAuthProvider();
    const user = provider.validateProviderUser({
      sub: 'google-user-123',
      email: 'USER@EXAMPLE.COM',
      name: 'User Example',
      picture: 'https://example.com/avatar.png',
      email_verified: true,
    });

    expect(user.provider).toBe('google');
    expect(user.providerUserId).toBe('google-user-123');
    expect(user.email).toBe('user@example.com');
    expect(user.fullName).toBe('User Example');
    expect(user.verifiedEmail).toBe(true);
  });

  it('preserves the provider display name without falling back to email', () => {
    const provider = new GoogleOAuthProvider();
    const user = provider.validateProviderUser({
      sub: 'google-user-456',
      email: 'profile@example.com',
      name: '  Profile Name  ',
      email_verified: true,
    });

    expect(user.fullName).toBe('Profile Name');
    expect(user.fullName).not.toBe('profile');
  });

  it('rejects incomplete Google profiles', () => {
    const provider = new GoogleOAuthProvider();

    expect(() =>
      provider.validateProviderUser({
        email: 'user@example.com',
      }),
    ).toThrow('missing required provider user id');
  });

  it('reports unconfigured provider state before migration', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CALLBACK_URL;

    const provider = new GoogleOAuthProvider();
    const status = provider.getConfigurationStatus();

    expect(status.isConfigured).toBe(false);
    expect(status.clientIdConfigured).toBe(false);
    expect(status.clientSecretConfigured).toBe(false);
    expect(status.callbackUrlConfigured).toBe(false);
  });
});
