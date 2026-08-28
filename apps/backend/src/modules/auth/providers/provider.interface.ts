export type OAuthProviderUser = {
  provider: 'google' | 'github';
  providerUserId: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  verifiedEmail: boolean;
};

export type ExistingProviderMatch = {
  kind: 'existing-provider' | 'existing-email' | 'none';
  userId?: string;
  reason?: string;
};

export interface AuthProvider<TIdentity = unknown> {
  readonly providerName: string;
  validateProviderUser(identity: TIdentity): OAuthProviderUser;
  findExistingAccount(providerUser: OAuthProviderUser): ExistingProviderMatch;
  linkProviderAccount(args: {
    userId: string;
    providerUser: OAuthProviderUser;
  }): Promise<void>;
}
