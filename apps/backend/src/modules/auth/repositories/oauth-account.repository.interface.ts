export type OAuthAccountRecord = {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string;
  email: string;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
};

export interface IOAuthAccountRepository {
  findByProviderAccount(
    provider: string,
    providerAccountId: string,
  ): Promise<OAuthAccountRecord | null>;
  findByUserAndProvider(
    userId: string,
    provider: string,
  ): Promise<OAuthAccountRecord | null>;
  findByUserId(userId: string): Promise<OAuthAccountRecord[]>;
  create(data: {
    user_id: string;
    provider: string;
    provider_account_id: string;
    email: string;
    email_verified: boolean;
  }): Promise<OAuthAccountRecord>;
}
