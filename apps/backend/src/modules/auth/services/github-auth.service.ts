import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { PasswordService } from '../../../common/security/password/password.service';
import { UsersService } from '../../users/services/users.service';
import {
  GithubOAuthProvider,
  type GithubProfile,
} from '../providers/github/github-oauth.provider';
import { AuthService } from './auth.service';
import { OAuthAccountService } from './oauth-account.service';
import { AuthRequestContext } from '../types/auth-request';

type GithubTokenResponse = { access_token?: string };
type GithubEmail = { email?: string; primary?: boolean; verified?: boolean };

@Injectable()
export class GithubAuthService {
  private readonly oauthStateTtlSeconds = 600;

  constructor(
    private readonly provider: GithubOAuthProvider,
    private readonly oauthAccountService: OAuthAccountService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private getFrontendBaseUrl(): string {
    return (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.FRONTEND_URL ??
      process.env.CLIENT_URL ??
      'http://localhost:3000'
    );
  }

  private getCallbackUrl(): string {
    return `${process.env.APP_URL ?? 'http://localhost:3001'}/api/v1/auth/github/callback`;
  }

  private getStateKey(state: string): string {
    return `oauth:github:state:${state}`;
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
        'GitHub OAuth state storage is unavailable.',
      );
    }
  }

  private async validateState(state?: string): Promise<void> {
    if (!state) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'GitHub authentication request was missing its security state.',
      );
    }

    const redisValue = await this.redis.get(this.getStateKey(state));
    if (redisValue == null) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'GitHub authentication request is invalid or expired.',
      );
    }

    await this.redis.del(this.getStateKey(state));
  }

  private successUrl(
    accessToken: string,
    refreshToken: string,
    user: { email: string; full_name: string },
  ): string {
    const params = new URLSearchParams({
      accessToken,
      refreshToken,
      userEmail: user.email,
      userName: user.full_name,
    });
    return `${this.getFrontendBaseUrl()}/auth/github/callback?${params.toString()}`;
  }

  private failureUrl(): string {
    return `${this.getFrontendBaseUrl()}/login?oauth_error=github_auth_failed`;
  }

  private async uniqueUsername(baseName: string): Promise<string> {
    const root =
      (baseName || 'githubuser')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 24) || 'githubuser';
    let candidate = root;
    let suffix = 1;
    while (
      await this.prisma.user.findUnique({ where: { username: candidate } })
    ) {
      candidate = `${root}${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private async createGithubUser(
    profile: ReturnType<GithubOAuthProvider['validateProviderUser']>,
  ) {
    const fullName = profile.fullName ?? profile.email.split('@')[0];
    const password = crypto.randomBytes(32).toString('hex');
    const user = await this.usersService.create({
      email: profile.email,
      username: await this.uniqueUsername(fullName),
      full_name: fullName,
      password,
      avatar_url: profile.avatarUrl ?? undefined,
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', email_verified_at: new Date() },
    });
    return this.usersService.findById(user.id);
  }

  async getLoginUrl(): Promise<string> {
    if (!this.provider.getConfigurationStatus().isConfigured) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'GitHub OAuth is not configured yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
      );
    }
    const state = this.createState();
    await this.saveState(state);
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID ?? '',
      redirect_uri: this.getCallbackUrl(),
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGithubCallback(input: {
    code?: string;
    state?: string;
    context?: AuthRequestContext;
  }) {
    if (!this.provider.getConfigurationStatus().isConfigured || !input.code) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'GitHub OAuth callback is unavailable.',
      );
    }
    await this.validateState(input.state);
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GITHUB_CLIENT_ID ?? '',
          client_secret: process.env.GITHUB_CLIENT_SECRET ?? '',
          code: input.code,
          redirect_uri: this.getCallbackUrl(),
        }),
      },
    );
    const token = (await tokenResponse.json()) as GithubTokenResponse;
    if (!tokenResponse.ok || !token.access_token)
      throw new Error('GitHub token exchange failed');

    const headers = {
      Authorization: `Bearer ${token.access_token}`,
      Accept: 'application/vnd.github+json',
    };
    const profileResponse = await fetch('https://api.github.com/user', {
      headers,
    });
    if (!profileResponse.ok) throw new Error('GitHub profile lookup failed');
    const profile = (await profileResponse.json()) as GithubProfile;
    if (!profile.email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers,
      });
      const emails = emailResponse.ok
        ? ((await emailResponse.json()) as GithubEmail[])
        : [];
      profile.email =
        emails.find((item) => item.primary && item.verified)?.email ?? null;
    }
    const providerUser = this.provider.validateProviderUser(profile);
    let user = null;
    const linked = await this.oauthAccountService.findProviderAccount(
      'github',
      providerUser.providerUserId,
    );
    if (linked) user = await this.usersService.findById(linked.user_id);
    if (!user) {
      if (await this.usersService.findByEmail(providerUser.email)) {
        throw ErrorService.create(
          ErrorCode.CONFLICT,
          'This GitHub account matches an existing CashFlow account.',
        );
      }
      user = await this.createGithubUser(providerUser);
      if (!user) throw new Error('GitHub user creation failed');
      await this.oauthAccountService.linkProviderAccount({
        userId: user.id,
        provider: 'github',
        providerAccountId: providerUser.providerUserId,
        email: providerUser.email,
        emailVerified: true,
      });
    }
    const session = await this.authService.issueSessionForUser(
      user,
      'github',
      input.context,
    );
    return {
      success: true,
      redirectUrl: this.successUrl(
        session.data.accessToken,
        session.data.refreshToken,
        user,
      ),
    };
  }

  handleGithubCallbackError() {
    return { success: false, redirectUrl: this.failureUrl() };
  }
}
