import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ITransactionsRepository } from './transactions.repository.interface';
import { TransactionEntity } from '../entities/transaction.entity';

type TxRec = any;

@Injectable()
export class PrismaTransactionsRepository implements ITransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: TxRec): TransactionEntity {
    const t = new TransactionEntity();
    t.id = rec.id;
    t.user_id = rec.user_id;
    t.account_id = rec.account_id;
    t.category_id = rec.category_id;
    t.transaction_type = rec.transaction_type;
    t.amount_cents = BigInt(rec.amount_cents as unknown as string ?? '0');
    t.transaction_date = rec.transaction_date;
    t.note = rec.note ?? null;
    t.reference_number = rec.reference_number ?? null;
    t.attachment_url = rec.attachment_url ?? null;
    t.location = rec.location ?? null;
    t.created_at = rec.created_at;
    t.updated_at = rec.updated_at;
    t.deleted_at = rec.deleted_at ?? null;
    return t;
  }

  async create(input: Partial<TransactionEntity>): Promise<TransactionEntity> {
    const data = { ...input } as any;
    if (input.amount_cents !== undefined) data.amount_cents = input.amount_cents.toString();
    const rec = await (this.prisma as any).transaction.create({ data });
    return this.map(rec as TxRec);
  }

  async findById(id: string): Promise<TransactionEntity | null> {
    const rec = await (this.prisma as any).transaction.findUnique({ where: { id } });
    if (!rec) return null;
    if (rec.deleted_at) return null;
    return this.map(rec as TxRec);
  }

  async findAllByUser(userId: string): Promise<TransactionEntity[]> {
    const recs: TxRec[] = await (this.prisma as any).transaction.findMany({ where: { user_id: userId, deleted_at: null }, orderBy: { transaction_date: 'desc' } });
    return recs.map((r: TxRec) => this.map(r));
  }

  async update(id: string, updates: Partial<TransactionEntity>): Promise<TransactionEntity> {
    const data: any = { ...updates };
    if (updates.amount_cents !== undefined) data.amount_cents = updates.amount_cents.toString();
    const rec = await (this.prisma as any).transaction.update({ where: { id }, data });
    return this.map(rec as TxRec);
  }

  async softDelete(id: string): Promise<void> {
    await (this.prisma as any).transaction.update({ where: { id }, data: { deleted_at: new Date() } });
  }
}
