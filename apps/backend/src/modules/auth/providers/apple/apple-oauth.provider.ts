import { Injectable } from '@nestjs/common';
import type {
  AuthProvider,
  ExistingProviderMatch,
  OAuthProviderUser,
} from '../provider.interface';

export type AppleProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
};

@Injectable()
export class AppleOAuthProvider implements AuthProvider<AppleProfile> {
  readonly providerName = 'apple';

  getConfigurationStatus() {
    const clientId = process.env.APPLE_CLIENT_ID;
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKey = process.env.APPLE_PRIVATE_KEY;
    const callbackUrl = process.env.APPLE_CALLBACK_URL;

    return {
      isConfigured: Boolean(clientId && teamId && keyId && privateKey && callbackUrl),
      clientIdConfigured: Boolean(clientId),
      teamIdConfigured: Boolean(teamId),
      keyIdConfigured: Boolean(keyId),
      privateKeyConfigured: Boolean(privateKey),
      callbackUrlConfigured: Boolean(callbackUrl),
    };
  }

  validateProviderUser(identity: AppleProfile): OAuthProviderUser {
    const providerUserId = identity?.sub?.trim();
    const email = identity?.email?.trim().toLowerCase() ?? '';
    const emailVerified =
      identity?.email_verified === true ||
      identity?.email_verified === 'true' ||
      identity?.email_verified === 'TRUE';

    if (!providerUserId) {
      throw new Error('Apple profile is missing required provider user id.');
    }

    return {
      provider: 'apple',
      providerUserId,
      email,
      fullName: null,
      avatarUrl: null,
      verifiedEmail: email ? emailVerified : false,
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
