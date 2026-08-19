import { ErrorCode } from '../../../common/errors/error-codes';
import { OAuthAccountService } from './oauth-account.service';

describe('OAuthAccountService', () => {
  const repo = {
    findByProviderAccount: jest.fn(),
    findByUserAndProvider: jest.fn(),
    findByUserId: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reuses an existing provider account when it belongs to the same user', async () => {
    const service = new OAuthAccountService(repo as any);
    repo.findByProviderAccount.mockResolvedValue({
      id: 'oauth-1',
      user_id: 'user-1',
      provider: 'google',
      provider_account_id: 'google-123',
      email: 'user@example.com',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const result = await service.linkProviderAccount({
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'user@example.com',
      emailVerified: true,
    });

    expect(result.user_id).toBe('user-1');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('blocks provider account linking when it is already tied to a different user', async () => {
    const service = new OAuthAccountService(repo as any);
    repo.findByProviderAccount.mockResolvedValue({
      id: 'oauth-2',
      user_id: 'another-user',
      provider: 'google',
      provider_account_id: 'google-123',
      email: 'user@example.com',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(
      service.linkProviderAccount({
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-123',
        email: 'user@example.com',
        emailVerified: true,
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.CONFLICT });
  });

  it('creates a new provider link when the user is new', async () => {
    const service = new OAuthAccountService(repo as any);
    repo.findByProviderAccount.mockResolvedValue(null);
    repo.findByUserAndProvider.mockResolvedValue(null);
    repo.create.mockResolvedValue({
      id: 'oauth-3',
      user_id: 'user-1',
      provider: 'google',
      provider_account_id: 'google-456',
      email: 'new@example.com',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const result = await service.linkProviderAccount({
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'google-456',
      email: 'new@example.com',
      emailVerified: true,
    });

    expect(repo.create).toHaveBeenCalledWith({
      user_id: 'user-1',
      provider: 'google',
      provider_account_id: 'google-456',
      email: 'new@example.com',
      email_verified: true,
    });
    expect(result.provider).toBe('google');
  });
});
