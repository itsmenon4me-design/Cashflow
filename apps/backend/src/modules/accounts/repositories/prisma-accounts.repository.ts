import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { IAccountsRepository } from './accounts.repository.interface';
import { AccountEntity } from '../entities/account.entity';

// Use any for Prisma Account type until Prisma client is regenerated during migration
type AccountRec = any;

@Injectable()
export class PrismaAccountsRepository implements IAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: AccountRec): AccountEntity {
    const a = new AccountEntity();
    a.id = rec.id;
    a.user_id = rec.user_id;
    a.name = rec.name;
    a.account_type = rec.account_type as any;
    a.currency = rec.currency;
    a.opening_balance_cents = BigInt(rec.opening_balance_cents as unknown as string ?? '0');
    a.current_balance_cents = BigInt(rec.current_balance_cents as unknown as string ?? '0');
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
    const rec = await (this.prisma as any).account.create({
      data: {
        user_id: input.user_id as string,
        name: input.name as string,
        account_type: input.account_type as string,
        currency: input.currency ?? 'IDR',
        opening_balance_cents: input.opening_balance_cents !== undefined ? input.opening_balance_cents.toString() : '0',
        current_balance_cents: input.current_balance_cents !== undefined ? input.current_balance_cents.toString() : (input.opening_balance_cents ?? 0).toString(),
        color: input.color ?? null,
        icon: input.icon ?? null,
        description: input.description ?? null,
        is_active: input.is_active ?? true,
        is_default: input.is_default ?? false,
      },
    });
    return this.map(rec as AccountRec);
  }

  async findById(id: string): Promise<AccountEntity | null> {
    const rec = await (this.prisma as any).account.findUnique({ where: { id } });
    if (!rec) return null;
    if (rec.deleted_at) return null;
    return this.map(rec as AccountRec);
  }

  async findAllByUser(userId: string): Promise<AccountEntity[]> {
    const recs: AccountRec[] = await (this.prisma as any).account.findMany({ where: { user_id: userId, deleted_at: null }, orderBy: { created_at: 'desc' } });
    return recs.map((r: AccountRec) => this.map(r));
  }

  async findByUserAndName(userId: string, name: string): Promise<AccountEntity | null> {
    const rec = await (this.prisma as any).account.findFirst({ where: { user_id: userId, name, deleted_at: null } });
    if (!rec) return null;
    return this.map(rec as AccountRec);
  }

  async update(id: string, updates: Partial<AccountEntity>): Promise<AccountEntity> {
    const data: any = { ...updates };
    if (updates.opening_balance_cents !== undefined) data.opening_balance_cents = updates.opening_balance_cents.toString();
    if (updates.current_balance_cents !== undefined) data.current_balance_cents = updates.current_balance_cents.toString();
    const rec = await (this.prisma as any).account.update({ where: { id }, data });
    return this.map(rec as AccountRec);
  }

  async softDelete(id: string): Promise<void> {
    await (this.prisma as any).account.update({ where: { id }, data: { deleted_at: new Date() } });
  }

  async findDefaultByUser(userId: string): Promise<AccountEntity | null> {
    const rec = await (this.prisma as any).account.findFirst({ where: { user_id: userId, is_default: true, deleted_at: null } });
    if (!rec) return null;
    return this.map(rec as AccountRec);
  }

  async unsetDefaultForUser(userId: string): Promise<void> {
    await (this.prisma as any).account.updateMany({ where: { user_id: userId, is_default: true }, data: { is_default: false } });
  }
}
