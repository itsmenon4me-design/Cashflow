import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';
import { toMinorUnitsExact } from '../../../common/types/money';

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string | null;
  /** Exact minor units as a string (BigInt-safe at the API boundary). */
  totalAmount: string;
  percentage: number;
  transactionCount: number;
}

export interface CategoryBreakdownResult {
  type: 'income' | 'expense';
  /** Exact minor units as a string (BigInt-safe at the API boundary). */
  total: string;
  categories: CategoryBreakdownItem[];
}

@Injectable()
export class CategoryBreakdownService {
  constructor(private readonly prisma: PrismaService) {}

  private validateMonthYear(month: number, year: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Invalid month');
    }

    if (!Number.isInteger(year) || year < 1970 || year > 3000) {
      throw new BadRequestException('Invalid year');
    }
  }

  private validateRange(range?: { start?: Date; end?: Date }): {
    start: Date;
    end: Date;
  } {
    if (!range?.start || !range?.end)
      throw new BadRequestException(
        'Date range requires both startDate and endDate',
      );
    if (isNaN(range.start.getTime()) || isNaN(range.end.getTime()))
      throw new BadRequestException('Invalid date range');
    if (range.start.getTime() > range.end.getTime())
      throw new BadRequestException('startDate must be before endDate');
    return { start: range.start, end: range.end };
  }

  async getBreakdown(
    userId: string,
    type: 'income' | 'expense',
    month?: number | string,
    year?: number | string,
    range?: { start?: Date; end?: Date },
  ): Promise<CategoryBreakdownResult> {
    if (type !== 'income' && type !== 'expense') {
      throw new BadRequestException('Invalid type');
    }

    const txType =
      type === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE;

    let start: Date;
    let end: Date;

    // Parse month/year from string if needed
    const monthNum = month !== undefined ? Number(month) : undefined;
    const yearNum = year !== undefined ? Number(year) : undefined;

    if (range && range.start && range.end) {
      const resolved = this.validateRange(range);
      start = resolved.start;
      end = resolved.end;
    } else {
      if (monthNum === undefined || yearNum === undefined)
        throw new BadRequestException('Month and year are required');
      this.validateMonthYear(monthNum, yearNum);
      start = new Date(yearNum, monthNum - 1, 1);
      end = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
    }

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

    const total = toMinorUnitsExact(totalAgg._sum?.amount_cents);

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
        total: total.toString(),
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
      const amount = toMinorUnitsExact(g._sum.amount_cents ?? 0);

      const percentage =
        total === 0n
          ? 0
          : Number(((Number(amount) / Number(total)) * 100).toFixed(2));

      return {
        categoryId: g.category_id,
        categoryName: nameById[g.category_id] ?? null,
        totalAmount: amount.toString(),
        percentage,
        transactionCount: g._count.id,
      };
    });

    items.sort((a, b) => {
      const diff = BigInt(b.totalAmount) - BigInt(a.totalAmount);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });

    return {
      type,
      total: total.toString(),
      categories: items,
    };
  }
}
