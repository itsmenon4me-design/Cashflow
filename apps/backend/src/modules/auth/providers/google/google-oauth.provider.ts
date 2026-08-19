import { Injectable } from '@nestjs/common';
import type {
  AuthProvider,
  ExistingProviderMatch,
  OAuthProviderUser,
} from '../provider.interface';

export type GoogleProfile = {
  sub?: string;
  email?: string;
  name?: string | null;
  picture?: string | null;
  email_verified?: boolean;
};

@Injectable()
export class GoogleOAuthProvider implements AuthProvider<GoogleProfile> {
  readonly providerName = 'google';

  getConfigurationStatus() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

    return {
      isConfigured: Boolean(clientId && clientSecret && callbackUrl),
      clientIdConfigured: Boolean(clientId),
      clientSecretConfigured: Boolean(clientSecret),
      callbackUrlConfigured: Boolean(callbackUrl),
    };
  }

  validateProviderUser(identity: GoogleProfile): OAuthProviderUser {
    const email = identity?.email?.trim().toLowerCase();
    const providerUserId = identity?.sub?.trim();

    if (!providerUserId) {
      throw new Error('Google profile is missing required provider user id.');
    }

    if (!email) {
      throw new Error('Google profile is missing required email address.');
    }

    return {
      provider: 'google',
      providerUserId,
      email,
      fullName: identity.name ?? null,
      avatarUrl: identity.picture ?? null,
      verifiedEmail: Boolean(identity.email_verified),
    };
  }

  findExistingAccount(providerUser: OAuthProviderUser): ExistingProviderMatch {
    if (!providerUser || !providerUser.providerUserId) {
      return { kind: 'none', reason: 'No provider user information was provided.' };
    }

    return {
      kind: 'none',
      reason: 'Provider linkage is resolved by the auth service against stored OAuth account records.',
    };
  }

  async linkProviderAccount(_: {
    userId: string;
    providerUser: OAuthProviderUser;
  }): Promise<void> {
    return;
  }
}
