import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { AppError } from '../../../common/errors/app-error';
import { ErrorService } from '../../../common/errors/error.service';
import { PasswordService } from '../../../common/security/password/password.service';
import { UsersService } from '../../users/services/users.service';
import {
  GoogleOAuthProvider,
  type GoogleProfile,
} from '../providers/google/google-oauth.provider';
import { AuthService } from './auth.service';
import { OAuthAccountService } from './oauth-account.service';
import { AuthRequestContext } from '../types/auth-request';

type GoogleTokenResponse = {
  access_token?: string;
};

@Injectable()
export class GoogleAuthService {
  private readonly oauthStateTtlSeconds = 600;

  constructor(
    private readonly provider: GoogleOAuthProvider,
    private readonly oauthAccountService: OAuthAccountService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
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

  private getStateKey(state: string): string {
    return `oauth:google:state:${state}`;
  }

  private createState(): string {
    return crypto.randomUUID();
  }

  private async saveState(state: string): Promise<void> {
    const saved = await this.redis.set(
      this.getStateKey(state),
      state,
      this.oauthStateTtlSeconds,
    );
    if (!saved) {
      throw ErrorService.create(
        ErrorCode.INTERNAL,
        'Google OAuth state storage is unavailable.',
      );
    }
  }

  private async validateState(state?: string): Promise<void> {
    if (!state) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Google authentication request was missing its security state.',
      );
    }

    const redisValue = await this.redis.get(this.getStateKey(state));
    if (redisValue == null) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Google authentication request is invalid or expired.',
      );
    }

    await this.redis.del(this.getStateKey(state));
  }

  private buildSuccessRedirectUrl(accessToken: string, refreshToken: string, user: { email: string; full_name: string }) {
    const params = new URLSearchParams({
      accessToken,
      refreshToken,
      userEmail: user.email,
      userName: user.full_name,
    });
    return `${this.getFrontendBaseUrl()}/auth/google/callback?${params.toString()}`;
  }

  private buildFailureRedirectUrl() {
    return `${this.getFrontendBaseUrl()}/login?oauth_error=google_auth_failed`;
  }

  private async generateUniqueUsername(baseName: string): Promise<string> {
    const normalized = (baseName || 'googleuser')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24);

    const root = normalized || 'googleuser';
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

  private async createGoogleUser(profile: ReturnType<GoogleOAuthProvider['validateProviderUser']>) {
    const fullName = profile.fullName ?? profile.email.split('@')[0];
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
        'Failed to resolve the newly created Google user.',
      );
    }

    return refreshed;
  }

  async getLoginUrl(): Promise<string> {
    const config = this.provider.getConfigurationStatus();
    if (!config.isConfigured) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Google OAuth is not configured yet. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.',
      );
    }

    const state = this.createState();
    await this.saveState(state);
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: process.env.GOOGLE_CALLBACK_URL ?? '',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(input: {
    code?: string;
    state?: string;
    context?: AuthRequestContext;
  }) {
    const config = this.provider.getConfigurationStatus();
    if (!config.isConfigured) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Google OAuth callback is unavailable until the provider credentials are configured.',
      );
    }

    if (!input.code) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Google callback did not include an authorization code.',
      );
    }

    await this.validateState(input.state);

    // debug-able holders for token/profile responses so we can log them on error
    let tokenResponse: any = undefined;
    let tokenData: any = undefined;
    let profileResponse: any = undefined;

    try {
      tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: input.code,
          client_id: process.env.GOOGLE_CLIENT_ID ?? '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          redirect_uri: process.env.GOOGLE_CALLBACK_URL ?? '',
          grant_type: 'authorization_code',
        }),
      });

      // Read raw body first to avoid 'Body has already been consumed' when logging
      let tokenRaw = '';
      // Some test mocks return an object with json(), others emulate Response with text().
      try {
        if (typeof tokenResponse.text === 'function') {
          tokenRaw = await tokenResponse.text().catch(() => '');
          try {
            tokenData = tokenRaw ? JSON.parse(tokenRaw) : ({} as GoogleTokenResponse);
          } catch (parseErr) {
            console.error('[GoogleAuth] failed to parse tokenResponse JSON from text', parseErr, 'raw:', tokenRaw);
            tokenData = {} as GoogleTokenResponse;
          }
        } else if (typeof tokenResponse.json === 'function') {
          tokenData = await tokenResponse.json().catch(() => ({} as GoogleTokenResponse));
          try {
            tokenRaw = tokenData ? JSON.stringify(tokenData) : '';
          } catch {
            tokenRaw = '';
          }
        } else {
          tokenData = {} as GoogleTokenResponse;
        }
      } catch (e) {
        console.error('[GoogleAuth] error reading tokenResponse body', e);
        tokenData = {} as GoogleTokenResponse;
      }

      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error('[GoogleAuth] token exchange response not ok or missing access_token', { status: tokenResponse && tokenResponse.status, tokenData, raw: tokenRaw });
        throw new Error('Google token exchange failed');
      }

      profileResponse = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        },
      );

      if (!profileResponse.ok) {
        throw new Error('Google profile lookup failed');
      }

      const profile = (await profileResponse.json()) as GoogleProfile;
      const providerUser = this.provider.validateProviderUser(profile);

      if (!providerUser.verifiedEmail) {
        throw ErrorService.create(
          ErrorCode.INVALID_INPUT,
          'Google email was not verified by Google.',
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
            'Google-linked account is unavailable.',
          );
        }
      } else {
        const existingUser = await this.usersService.findByEmail(providerUser.email);
        if (existingUser) {
          throw ErrorService.create(
            ErrorCode.CONFLICT,
            'This Google account matches an existing CashFlow account. Please sign in to that account and link Google from settings.',
          );
        }

        user = await this.createGoogleUser(providerUser);
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
            'Google account link could not be created.',
          );
        }
      }

      if (!user) {
        throw ErrorService.create(
          ErrorCode.UNAUTHORIZED,
          'Google-linked user could not be resolved.',
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
          'Google-linked user could not be resolved after activation.',
        );
      }

      const session = await this.authService.issueSessionForUser(
        user,
        'google',
        input.context,
      );
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
      try {
        console.error('[GoogleAuth] handleGoogleCallback error:', error);

        if (tokenResponse) {
          try {
            const trText = await (tokenResponse.clone ? tokenResponse.clone().text() : tokenResponse.text()).catch(() => '<unreadable>');
            console.error('[GoogleAuth] tokenResponse status:', tokenResponse.status, 'body:', trText);
          } catch (e) {
            console.error('[GoogleAuth] failed to read tokenResponse body', e);
          }
        }

        if (typeof tokenData !== 'undefined') {
          try {
            console.error('[GoogleAuth] tokenData:', tokenData);
          } catch (e) {
            console.error('[GoogleAuth] failed to log tokenData', e);
          }
        }

        if (profileResponse) {
          try {
            const prText = await (profileResponse.clone ? profileResponse.clone().text() : profileResponse.text()).catch(() => '<unreadable>');
            console.error('[GoogleAuth] profileResponse status:', profileResponse.status, 'body:', prText);
          } catch (e) {
            console.error('[GoogleAuth] failed to read profileResponse body', e);
          }
        }
      } catch (logErr) {
        console.error('[GoogleAuth] error while logging error:', logErr);
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Google authentication failed. Please try again.',
      );
    }
  }

  handleGoogleCallbackError() {
    return {
      success: false,
      redirectUrl: this.buildFailureRedirectUrl(),
    };
  }
}

