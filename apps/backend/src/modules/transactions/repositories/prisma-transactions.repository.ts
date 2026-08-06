import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ITransactionsRepository } from './transactions.repository.interface';
import { TransactionEntity } from '../entities/transaction.entity';
import type { Transaction, Prisma } from '@prisma/client';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { PaginationDto } from '../dto/pagination.dto';

type TxRec = Transaction & { account?: { currency?: string } };

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
    const amt =
      typeof rec.amount_cents === 'bigint'
        ? rec.amount_cents
        : BigInt(String(rec.amount_cents ?? 0));
    t.amount_cents = amt;
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
    const data: Prisma.TransactionCreateInput = {
      user_id: input.user_id!,
      account_id: input.account_id!,
      category_id: input.category_id ?? undefined,
      transaction_type:
        input.transaction_type as Prisma.TransactionCreateInput['transaction_type'],
      amount_cents:
        typeof input.amount_cents === 'bigint'
          ? input.amount_cents
          : BigInt(String(input.amount_cents ?? 0)),
      transaction_date: input.transaction_date ?? new Date(),
      note: input.note ?? null,
      reference_number: input.reference_number ?? null,
      attachment_url: input.attachment_url ?? null,
      location: input.location ?? null,
    } as unknown as Prisma.TransactionCreateInput;

    const rec = await this.prisma.transaction.create({
      data,
    });

    return this.map(rec);
  }

  async findById(id: string): Promise<TransactionEntity | null> {
    const rec = await this.prisma.transaction.findUnique({
      where: { id },
    });
    if (!rec) return null;
    if (rec.deleted_at) return null;
    return this.map(rec);
  }

  async findAllByUser(userId: string): Promise<TransactionEntity[]> {
    const recs: TxRec[] = await this.prisma.transaction.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { transaction_date: 'desc' },
    });
    return recs.map((r: TxRec) => this.map(r));
  }

  async findByUserWithFilter(
    userId: string,
    filter: TransactionFilterDto,
    pagination: PaginationDto,
  ) {
    const where: Prisma.TransactionWhereInput = {
      user_id: userId,
      deleted_at: null,
    };

    if (filter?.accountId) where.account_id = filter.accountId;
    if (filter?.categoryId) where.category_id = filter.categoryId;
    if (filter?.type) where.transaction_type = filter.type;
    if (filter?.fromDate || filter?.toDate) {
      where.transaction_date = {};
      if (filter.fromDate)
        (where.transaction_date as Prisma.DateTimeFilter).gte = new Date(
          filter.fromDate,
        );
      if (filter.toDate)
        (where.transaction_date as Prisma.DateTimeFilter).lte = new Date(
          filter.toDate,
        );
    }
    if (filter?.minAmount !== undefined || filter?.maxAmount !== undefined) {
      where.amount_cents = {};
      if (filter.minAmount !== undefined)
        (where.amount_cents as Prisma.BigIntFilter).gte = BigInt(
          filter.minAmount,
        );
      if (filter.maxAmount !== undefined)
        (where.amount_cents as Prisma.BigIntFilter).lte = BigInt(
          filter.maxAmount,
        );
    }
    if (filter?.hasAttachment !== undefined) {
      const has = String(filter.hasAttachment).toLowerCase() === 'true';
      if (has) where.attachment_url = { not: null };
      else where.attachment_url = null;
    }

    // Sorting
    let orderBy: Prisma.TransactionOrderByWithRelationInput = {
      transaction_date: 'desc',
    };
    if (filter?.sortBy) {
      const dir = filter.sortOrder === 'asc' ? 'asc' : 'desc';
      if (filter.sortBy === 'date') orderBy = { transaction_date: dir };
      if (filter.sortBy === 'amount') orderBy = { amount_cents: dir };
      if (filter.sortBy === 'createdAt') orderBy = { created_at: dir };
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const skip = (page - 1) * limit;
    const take = limit;

    // Build prisma query
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          account: true,
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    // If currency filter present, filter items by account currency post-query (safe fallback)
    const finalItems: TxRec[] = filter?.currency
      ? items.filter((it) => it.account?.currency === filter.currency)
      : items;

    return { items: finalItems.map((r: TxRec) => this.map(r)), total };
  }

  async searchByUser(userId: string, q: string, pagination: PaginationDto) {
    const where: Prisma.TransactionWhereInput = {
      user_id: userId,
      deleted_at: null,
    };

    const query = q.trim();
    const or: Prisma.TransactionWhereInput[] = [];

    // note, reference_number
    or.push({
      note: { contains: query, mode: 'insensitive' },
    });
    or.push({
      reference_number: { contains: query, mode: 'insensitive' },
    });

    // transaction id exact match
    if (/^[0-9a-fA-F-]{8,}$/.test(query)) {
      or.push({ id: query });
    }

    // amount exact match if numeric
    const num = Number(query);
    if (!Number.isNaN(num)) {
      try {
        const cents = BigInt(Math.round(num));
        or.push({ amount_cents: cents });
      } catch {
        // ignore
      }
    }

    // transaction type
    const up = query.toUpperCase();
    if (up === 'INCOME' || up === 'EXPENSE') or.push({ transaction_type: up });

    // Account name and Category name using relations
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const skip = (page - 1) * limit;
    const take = limit;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          AND: [where, { OR: or }],
        },
        include: { account: true, category: true },
        orderBy: { transaction_date: 'desc' },
        skip,
        take,
      }),
      this.prisma.transaction.count({ where: { AND: [where, { OR: or }] } }),
    ]);

    return { items: (items as TxRec[]).map((r: TxRec) => this.map(r)), total };
  }

  async update(
    id: string,
    updates: Partial<TransactionEntity>,
  ): Promise<TransactionEntity> {
    const data: Prisma.TransactionUpdateInput = {};
    if (updates.amount_cents !== undefined) {
      data.amount_cents =
        typeof updates.amount_cents === 'bigint'
          ? updates.amount_cents
          : BigInt(String(updates.amount_cents));
    }
    // copy other updatable fields
    if (updates.note !== undefined) data.note = updates.note;
    if (updates.reference_number !== undefined)
      data.reference_number = updates.reference_number;
    if (updates.attachment_url !== undefined)
      data.attachment_url = updates.attachment_url;
    if (updates.transaction_date !== undefined)
      data.transaction_date = updates.transaction_date;

    const rec = await this.prisma.transaction.update({
      where: { id },
      data,
    });
    return this.map(rec);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.transaction.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
