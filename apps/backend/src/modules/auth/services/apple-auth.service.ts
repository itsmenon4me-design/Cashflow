import { Injectable } from '@nestjs/common';
import { createPublicKey } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../../database/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { AppError } from '../../../common/errors/app-error';
import { ErrorService } from '../../../common/errors/error.service';
import { PasswordService } from '../../../common/security/password/password.service';
import { UsersService } from '../../users/services/users.service';
import { AppleOAuthProvider, type AppleProfile } from '../providers/apple/apple-oauth.provider';
import { AuthService } from './auth.service';
import { OAuthAccountService } from './oauth-account.service';
import * as crypto from 'crypto';

type AppleTokenResponse = {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

@Injectable()
export class AppleAuthService {
  private readonly stateStore = new Map<string, number>();

  constructor(
    private readonly provider: AppleOAuthProvider,
    private readonly oauthAccountService: OAuthAccountService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
  ) {}

  getConfigurationStatus() {
    return this.provider.getConfigurationStatus();
  }

  private getFrontendBaseUrl(): string {
    return (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.FRONTEND_URL ??
      process.env.CLIENT_URL ??
      'http://localhost:3000'
    );
  }

  private pruneStateStore() {
    const now = Date.now();
    for (const [state, createdAt] of this.stateStore.entries()) {
      if (now - createdAt > 10 * 60 * 1000) {
        this.stateStore.delete(state);
      }
    }
  }

  private createState(): string {
    this.pruneStateStore();
    const state = crypto.randomUUID();
    this.stateStore.set(state, Date.now());
    return state;
  }

  private validateState(state?: string): void {
    if (!state) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple authentication request was missing its security state.',
      );
    }

    this.pruneStateStore();
    const exists = this.stateStore.get(state);
    if (exists === undefined) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple authentication request is invalid or expired.',
      );
    }

    this.stateStore.delete(state);
  }

  private buildSuccessRedirectUrl(
    accessToken: string,
    refreshToken: string,
    user: { email: string; full_name: string },
  ) {
    const params = new URLSearchParams({
      accessToken,
      refreshToken,
      userEmail: user.email,
      userName: user.full_name,
    });
    return `${this.getFrontendBaseUrl()}/auth/apple/callback?${params.toString()}`;
  }

  private buildFailureRedirectUrl() {
    return `${this.getFrontendBaseUrl()}/login?oauth_error=apple_auth_failed`;
  }

  private getAppleClientSecret(): string {
    const clientId = process.env.APPLE_CLIENT_ID;
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r/g, '');

    if (!clientId || !teamId || !keyId || !privateKey) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple OAuth is not configured yet. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, and APPLE_CALLBACK_URL.',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        iss: teamId,
        iat: now,
        exp: now + 15777000,
        aud: 'https://appleid.apple.com',
        sub: clientId,
      },
      privateKey,
      {
        algorithm: 'ES256',
        keyid: keyId,
      },
    );
  }

  private async verifyAppleIdToken(idToken: string): Promise<AppleProfile> {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded !== 'object' || !decoded.header || !decoded.payload) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple identity token is malformed.',
      );
    }

    const header = decoded.header as { kid?: string; alg?: string };
    if (header.alg !== 'RS256') {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple identity token is signed with an unsupported algorithm.',
      );
    }

    const jwksResponse = await fetch('https://appleid.apple.com/auth/keys');
    if (!jwksResponse.ok) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple identity verification service is unavailable.',
      );
    }

    const jwks = (await jwksResponse.json()) as {
      keys?: Array<{ kid?: string; kty?: string; n?: string; e?: string; alg?: string; use?: string }>;
    };
    const signingKey = jwks.keys?.find((key) => key.kid === header.kid);

    if (!signingKey || !signingKey.kty || !signingKey.n || !signingKey.e) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple identity signature key could not be resolved.',
      );
    }

    try {
      const publicKey = createPublicKey({
        key: {
          kty: signingKey.kty,
          n: signingKey.n,
          e: signingKey.e,
        },
        format: 'jwk',
      });

      return jwt.verify(idToken, publicKey, {
        algorithms: ['RS256'],
        audience: process.env.APPLE_CLIENT_ID ?? '',
        issuer: 'https://appleid.apple.com',
      }) as AppleProfile;
    } catch {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple identity token is invalid or expired.',
      );
    }
  }

  private async generateUniqueUsername(baseName: string): Promise<string> {
    const normalized = (baseName || 'appleuser')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24);

    const root = normalized || 'appleuser';
    let candidate = root;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
      });

      if (!existing) {
        return candidate;
      }

      candidate = `${root}${suffix}`;
      suffix += 1;
    }
  }

  private async createAppleUser(profile: ReturnType<AppleOAuthProvider['validateProviderUser']>) {
    if (!profile.email) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple account identity did not include a verified email address.',
      );
    }

    const fullName = profile.fullName ?? profile.email.split('@')[0] ?? 'Apple User';
    const username = await this.generateUniqueUsername(fullName);
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await this.passwordService.hashPassword(randomPassword);

    const user = await this.usersService.create({
      email: profile.email,
      username,
      full_name: fullName,
      password: randomPassword,
      avatar_url: profile.avatarUrl ?? undefined,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        email_verified_at: new Date(),
        password_hash: passwordHash,
      },
    });

    const refreshed = await this.usersService.findById(user.id);
    if (!refreshed) {
      throw ErrorService.create(
        ErrorCode.INTERNAL,
        'Failed to resolve the newly created Apple user.',
      );
    }

    return refreshed;
  }

  getLoginUrl(): string {
    const config = this.provider.getConfigurationStatus();
    if (!config.isConfigured) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple OAuth is not configured yet. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, and APPLE_CALLBACK_URL.',
      );
    }

    const state = this.createState();
    const params = new URLSearchParams({
      client_id: process.env.APPLE_CLIENT_ID ?? '',
      redirect_uri: process.env.APPLE_CALLBACK_URL ?? '',
      response_type: 'code',
      scope: 'name email',
      response_mode: 'query',
      state,
    });

    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }

  async handleAppleCallback(input: { code?: string; state?: string }) {
    const config = this.provider.getConfigurationStatus();
    if (!config.isConfigured) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple OAuth callback is unavailable until the provider credentials are configured.',
      );
    }

    if (!input.code) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple callback did not include an authorization code.',
      );
    }

    this.validateState(input.state);

    try {
      const appleClientSecret = this.getAppleClientSecret();
      const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.APPLE_CLIENT_ID ?? '',
          client_secret: appleClientSecret,
          code: input.code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.APPLE_CALLBACK_URL ?? '',
        }),
      });

      const tokenData = (await tokenResponse.json().catch(() => ({}))) as AppleTokenResponse;
      if (!tokenResponse.ok || !tokenData.id_token) {
        throw new Error('Apple token exchange failed');
      }

      const profile = await this.verifyAppleIdToken(tokenData.id_token);
      const providerUser = this.provider.validateProviderUser(profile);

      if (!providerUser.email) {
        throw ErrorService.create(
          ErrorCode.INVALID_INPUT,
          'Apple account identity did not include a verified email address.',
        );
      }

      if (!providerUser.verifiedEmail) {
        throw ErrorService.create(
          ErrorCode.INVALID_INPUT,
          'Apple email was not verified by Apple.',
        );
      }

      let user: Awaited<ReturnType<UsersService['findByEmail']>> = null;
      let existingProviderAccount = await this.oauthAccountService.findProviderAccount(
        providerUser.provider,
        providerUser.providerUserId,
      );

      if (existingProviderAccount) {
        user = await this.usersService.findById(existingProviderAccount.user_id);
        if (!user) {
          throw ErrorService.create(
            ErrorCode.UNAUTHORIZED,
            'Apple-linked account is unavailable.',
          );
        }
      } else {
        const existingUser = await this.usersService.findByEmail(providerUser.email);
        if (existingUser) {
          throw ErrorService.create(
            ErrorCode.CONFLICT,
            'This Apple account matches an existing CashFlow account. Please sign in to that account and link Apple from settings.',
          );
        }

        user = await this.createAppleUser(providerUser);
        existingProviderAccount = await this.oauthAccountService.linkProviderAccount({
          userId: user.id,
          provider: providerUser.provider,
          providerAccountId: providerUser.providerUserId,
          email: providerUser.email,
          emailVerified: true,
        });
        if (!existingProviderAccount) {
          throw ErrorService.create(
            ErrorCode.INTERNAL,
            'Apple account link could not be created.',
          );
        }
      }

      if (!user) {
        throw ErrorService.create(
          ErrorCode.UNAUTHORIZED,
          'Apple-linked user could not be resolved.',
        );
      }

      if (user.status === 'PENDING_VERIFICATION') {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: 'ACTIVE',
            email_verified_at: new Date(),
          },
        });
        user = await this.usersService.findById(user.id);
      }

      if (!user) {
        throw ErrorService.create(
          ErrorCode.UNAUTHORIZED,
          'Apple-linked user could not be resolved after activation.',
        );
      }

      const session = await this.authService.issueSessionForUser(user, 'apple');
      return {
        success: true,
        redirectUrl: this.buildSuccessRedirectUrl(
          session.data.accessToken,
          session.data.refreshToken,
          {
            email: user.email,
            full_name: user.full_name,
          },
        ),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Apple authentication failed. Please try again.',
      );
    }
  }

  handleAppleCallbackError() {
    return {
      success: false,
      redirectUrl: this.buildFailureRedirectUrl(),
    };
  }
}
