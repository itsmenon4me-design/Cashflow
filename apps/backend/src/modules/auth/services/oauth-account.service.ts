import { Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import type { OAuthAccountRecord } from '../repositories/oauth-account.repository.interface';
import { PrismaOauthAccountRepository } from '../repositories/prisma-oauth-account.repository';

@Injectable()
export class OAuthAccountService {
  constructor(
    private readonly oauthAccountRepository: PrismaOauthAccountRepository,
  ) {}

  async findProviderAccount(
    provider: string,
    providerAccountId: string,
  ): Promise<OAuthAccountRecord | null> {
    return this.oauthAccountRepository.findByProviderAccount(
      provider,
      providerAccountId,
    );
  }

  async findByUserAndProvider(
    userId: string,
    provider: string,
  ): Promise<OAuthAccountRecord | null> {
    return this.oauthAccountRepository.findByUserAndProvider(userId, provider);
  }

  async findByUserId(userId: string): Promise<OAuthAccountRecord[]> {
    return this.oauthAccountRepository.findByUserId(userId);
  }

  async createProviderAccount(data: {
    user_id: string;
    provider: string;
    provider_account_id: string;
    email: string;
    email_verified: boolean;
  }): Promise<OAuthAccountRecord> {
    const existing = await this.oauthAccountRepository.findByProviderAccount(
      data.provider,
      data.provider_account_id,
    );

    if (existing && existing.user_id !== data.user_id) {
      throw ErrorService.create(
        ErrorCode.CONFLICT,
        'This provider account is already linked to a different user.',
      );
    }

    const existingForUser = await this.oauthAccountRepository.findByUserAndProvider(
      data.user_id,
      data.provider,
    );

    if (existingForUser) {
      return existingForUser;
    }

    return this.oauthAccountRepository.create(data);
  }

  async linkProviderAccount(data: {
    userId: string;
    provider: string;
    providerAccountId: string;
    email: string;
    emailVerified: boolean;
  }): Promise<OAuthAccountRecord> {
    const existing = await this.oauthAccountRepository.findByProviderAccount(
      data.provider,
      data.providerAccountId,
    );

    if (existing && existing.user_id !== data.userId) {
      throw ErrorService.create(
        ErrorCode.CONFLICT,
        'This provider account is already linked to a different CashFlow user.',
      );
    }

    if (existing && existing.user_id === data.userId) {
      return existing;
    }

    const existingForUser = await this.oauthAccountRepository.findByUserAndProvider(
      data.userId,
      data.provider,
    );

    if (existingForUser) {
      return existingForUser;
    }

    return this.oauthAccountRepository.create({
      user_id: data.userId,
      provider: data.provider,
      provider_account_id: data.providerAccountId,
      email: data.email,
      email_verified: data.emailVerified,
    });
  }
}
