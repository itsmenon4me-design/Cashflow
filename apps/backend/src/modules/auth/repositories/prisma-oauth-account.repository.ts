import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { OAuthAccount as PrismaOAuthAccount } from '../../../generated/prisma/client';
import type {
  IOAuthAccountRepository,
  OAuthAccountRecord,
} from './oauth-account.repository.interface';

@Injectable()
export class PrismaOauthAccountRepository implements IOAuthAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(record: PrismaOAuthAccount): OAuthAccountRecord {
    return {
      id: record.id,
      user_id: record.user_id,
      provider: record.provider,
      provider_account_id: record.provider_account_id,
      email: record.email,
      email_verified: record.email_verified,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  async findByProviderAccount(
    provider: string,
    providerAccountId: string,
  ): Promise<OAuthAccountRecord | null> {
    const record = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_provider_account_id: {
          provider,
          provider_account_id: providerAccountId,
        },
      },
    });

    return record ? this.map(record) : null;
  }

  async findByUserAndProvider(
    userId: string,
    provider: string,
  ): Promise<OAuthAccountRecord | null> {
    const record = await this.prisma.oAuthAccount.findUnique({
      where: {
        user_id_provider: {
          user_id: userId,
          provider,
        },
      },
    });

    return record ? this.map(record) : null;
  }

  async findByUserId(userId: string): Promise<OAuthAccountRecord[]> {
    const records = await this.prisma.oAuthAccount.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    return records.map((record: PrismaOAuthAccount) => this.map(record));
  }

  async create(data: {
    user_id: string;
    provider: string;
    provider_account_id: string;
    email: string;
    email_verified: boolean;
  }): Promise<OAuthAccountRecord> {
    const record = await this.prisma.oAuthAccount.create({
      data: {
        user_id: data.user_id,
        provider: data.provider,
        provider_account_id: data.provider_account_id,
        email: data.email,
        email_verified: data.email_verified,
      },
    });

    return this.map(record);
  }
}
