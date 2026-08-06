import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '@prisma/client';

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string | null;
  totalAmount: number;
  percentage: number;
  transactionCount: number;
}

export interface CategoryBreakdownResult {
  type: 'income' | 'expense';
  total: number;
  categories: CategoryBreakdownItem[];
}

@Injectable()
export class CategoryBreakdownService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeToNumber(v: unknown): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    }
    return 0;
  }

  private validateMonthYear(month: number, year: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Invalid month');
    }

    if (!Number.isInteger(year) || year < 1970 || year > 3000) {
      throw new BadRequestException('Invalid year');
    }
  }

  async getBreakdown(
    userId: string,
    type: 'income' | 'expense',
    month: number,
    year: number,
  ): Promise<CategoryBreakdownResult> {
    this.validateMonthYear(month, year);

    if (type !== 'income' && type !== 'expense') {
      throw new BadRequestException('Invalid type');
    }

    const txType =
      type === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const totalAgg = await this.prisma.transaction.aggregate({
      where: {
        user_id: userId,
        deleted_at: null,
        transaction_type: txType,
        transaction_date: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount_cents: true,
      },
    });

    const total = this.normalizeToNumber(totalAgg._sum?.amount_cents ?? 0);

    const groups = await this.prisma.transaction.groupBy({
      by: ['category_id'],
      where: {
        user_id: userId,
        deleted_at: null,
        transaction_type: txType,
        transaction_date: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount_cents: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          amount_cents: 'desc',
        },
      },
    });

    if (groups.length === 0) {
      return {
        type,
        total,
        categories: [],
      };
    }

    const categoryIds = groups.map((g) => g.category_id).filter(Boolean);

    const cats = await this.prisma.category.findMany({
      where: {
        id: {
          in: categoryIds,
        },
      },
    });

    const nameById: Record<string, string | null> = {};

    for (const c of cats) {
      nameById[c.id] = c.name;
    }

    const items: CategoryBreakdownItem[] = groups.map((g) => {
      const amount = this.normalizeToNumber(g._sum.amount_cents ?? 0);

      const percentage =
        total === 0 ? 0 : Number(((amount / total) * 100).toFixed(2));

      return {
        categoryId: g.category_id,
        categoryName: nameById[g.category_id] ?? null,
        totalAmount: amount,
        percentage,
        transactionCount: g._count.id,
      };
    });

    items.sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      type,
      total,
      categories: items,
    };
  }
}
