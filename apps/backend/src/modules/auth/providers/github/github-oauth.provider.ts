import { Injectable } from '@nestjs/common';
import type {
  AuthProvider,
  ExistingProviderMatch,
  OAuthProviderUser,
} from '../provider.interface';

export type GithubProfile = {
  id?: number | string;
  login?: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

@Injectable()
export class GithubOAuthProvider implements AuthProvider<GithubProfile> {
  readonly providerName = 'github';

  getConfigurationStatus() {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    return {
      isConfigured: Boolean(clientId && clientSecret),
      clientIdConfigured: Boolean(clientId),
      clientSecretConfigured: Boolean(clientSecret),
    };
  }

  validateProviderUser(identity: GithubProfile): OAuthProviderUser {
    const email = identity?.email?.trim().toLowerCase();
    const providerUserId = identity?.id ? String(identity.id).trim() : '';

    if (!providerUserId) {
      throw new Error('GitHub profile is missing required provider user id.');
    }

    if (!email) {
      throw new Error('GitHub profile is missing required email address.');
    }

    return {
      provider: 'github',
      providerUserId,
      email,
      fullName: identity.name ?? identity.login ?? null,
      avatarUrl: identity.avatar_url ?? null,
      verifiedEmail: true,
    };
  }

  findExistingAccount(providerUser: OAuthProviderUser): ExistingProviderMatch {
    if (!providerUser || !providerUser.providerUserId) {
      return {
        kind: 'none',
        reason: 'No provider user information was provided.',
      };
    }

    return {
      kind: 'none',
      reason:
        'Provider linkage is resolved by the auth service against stored OAuth account records.',
    };
  }

  async linkProviderAccount(_: {
    userId: string;
    providerUser: OAuthProviderUser;
  }): Promise<void> {
    return;
  }
}
