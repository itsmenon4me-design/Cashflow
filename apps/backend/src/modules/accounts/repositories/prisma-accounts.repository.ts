import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { IAccountsRepository } from './accounts.repository.interface';
import { AccountEntity } from '../entities/account.entity';
import type { Account } from '../../../generated/prisma/client';

type AccountRec = Account;

@Injectable()
export class PrismaAccountsRepository implements IAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: AccountRec): AccountEntity {
    const a = new AccountEntity();

    a.id = rec.id;
    a.user_id = rec.user_id;
    a.name = rec.name;
    a.account_type = rec.account_type as AccountEntity['account_type'];
    a.currency = rec.currency;

    const ob = rec.opening_balance_cents ?? 0;
    a.opening_balance_cents = typeof ob === 'bigint' ? ob : BigInt(ob);

    const cb = rec.current_balance_cents ?? ob;
    a.current_balance_cents = typeof cb === 'bigint' ? cb : BigInt(cb);

    a.color = rec.color ?? null;
    a.icon = rec.icon ?? null;
    a.description = rec.description ?? null;

    a.is_active = rec.is_active;
    a.is_default = rec.is_default;

    a.created_at = rec.created_at;
    a.updated_at = rec.updated_at;
    a.deleted_at = rec.deleted_at ?? null;

    return a;
  }

  async create(input: Partial<AccountEntity>): Promise<AccountEntity> {
    const openingBalance = input.opening_balance_cents ?? 0n;
    const currentBalance = input.current_balance_cents ?? openingBalance;

    const rec = await this.prisma.account.create({
      data: {
        user_id: input.user_id!,
        name: input.name!,
        account_type: input.account_type ?? 'OTHER',
        currency: input.currency ?? 'IDR',

        opening_balance_cents: openingBalance,
        current_balance_cents: currentBalance,

        color: input.color ?? null,
        icon: input.icon ?? null,
        description: input.description ?? null,

        is_active: input.is_active ?? true,
        is_default: input.is_default ?? false,
      },
    });

    return this.map(rec);
  }

  async findById(id: string): Promise<AccountEntity | null> {
    const rec = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!rec || rec.deleted_at) {
      return null;
    }

    return this.map(rec);
  }

  async findAllByUser(userId: string): Promise<AccountEntity[]> {
    const recs: AccountRec[] = await this.prisma.account.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return recs.map((r) => this.map(r));
  }

  async findAll(): Promise<AccountEntity[]> {
    const recs: AccountRec[] = await this.prisma.account.findMany({
      where: {
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return recs.map((r) => this.map(r));
  }

  async findByUserAndName(
    userId: string,
    name: string,
  ): Promise<AccountEntity | null> {
    const rec = await this.prisma.account.findFirst({
      where: {
        user_id: userId,
        name,
        deleted_at: null,
      },
    });

    return rec ? this.map(rec) : null;
  }

  async update(
    id: string,
    updates: Partial<AccountEntity>,
  ): Promise<AccountEntity> {
    const data: {
      name?: string;
      account_type?: AccountEntity['account_type'];
      currency?: string;
      opening_balance_cents?: bigint;
      current_balance_cents?: bigint;
      color?: string | null;
      icon?: string | null;
      description?: string | null;
      is_active?: boolean;
      is_default?: boolean;
    } = {};

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.account_type !== undefined)
      data.account_type = updates.account_type;
    if (updates.currency !== undefined) data.currency = updates.currency;

    if (updates.opening_balance_cents !== undefined) {
      data.opening_balance_cents =
        typeof updates.opening_balance_cents === 'bigint'
          ? updates.opening_balance_cents
          : BigInt(updates.opening_balance_cents);
    }

    if (updates.current_balance_cents !== undefined) {
      data.current_balance_cents =
        typeof updates.current_balance_cents === 'bigint'
          ? updates.current_balance_cents
          : BigInt(updates.current_balance_cents);
    }

    if (updates.color !== undefined) data.color = updates.color;
    if (updates.icon !== undefined) data.icon = updates.icon;
    if (updates.description !== undefined)
      data.description = updates.description;
    if (updates.is_active !== undefined) data.is_active = updates.is_active;
    if (updates.is_default !== undefined) data.is_default = updates.is_default;

    const rec = await this.prisma.account.update({
      where: { id },
      data,
    });

    return this.map(rec);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.account.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });
  }

  async findDefaultByUser(userId: string): Promise<AccountEntity | null> {
    const rec = await this.prisma.account.findFirst({
      where: {
        user_id: userId,
        is_default: true,
        deleted_at: null,
      },
    });

    return rec ? this.map(rec) : null;
  }

  async unsetDefaultForUser(userId: string): Promise<void> {
    await this.prisma.account.updateMany({
      where: {
        user_id: userId,
        is_default: true,
      },
      data: {
        is_default: false,
      },
    });
  }
}
