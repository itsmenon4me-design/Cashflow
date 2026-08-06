import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '@prisma/client';
import type { Category } from '@prisma/client';

interface CategoryGroup {
  category_id?: string | null;
  _sum?: { amount_cents?: number | bigint | string | null } | null;
}

export interface CategoryTotal {
  categoryId: string;
  name: string | null;
  total: number;
}

export interface MonthlyReportResult {
  month: number;
  year: number;
  summary: {
    income: number;
    expense: number;
    netCashFlow: number;
    transactions: number;
  };
  topExpenseCategories: CategoryTotal[];
  topIncomeCategories: CategoryTotal[];
}

@Injectable()
export class MonthlyReportService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeToNumber(v: unknown): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    }
    if (typeof v === 'number') return v;
    return 0;
  }

  private validateMonthYear(month: number, year: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12)
      throw new BadRequestException('Invalid month');
    if (!Number.isInteger(year) || year < 1970 || year > 3000)
      throw new BadRequestException('Invalid year');
  }

  async getMonthlyReport(
    userId: string,
    month: number,
    year: number,
  ): Promise<MonthlyReportResult> {
    this.validateMonthYear(month, year);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // aggregates income and expense
    const [incAgg, expAgg, txCount] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_type: TransactionType.INCOME,
          transaction_date: { gte: start, lte: end },
        },
        _sum: { amount_cents: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
          transaction_date: { gte: start, lte: end },
        },
        _sum: { amount_cents: true },
      }),
      this.prisma.transaction.count({
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_date: { gte: start, lte: end },
        },
      }),
    ]);

    const income = this.normalizeToNumber(incAgg._sum?.amount_cents ?? 0);
    const expense = this.normalizeToNumber(expAgg._sum?.amount_cents ?? 0);

    // top categories using groupBy
    const groupResults = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['category_id'],
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
          transaction_date: { gte: start, lte: end },
        },
        _sum: { amount_cents: true },
        orderBy: { _sum: { amount_cents: 'desc' } },
        take: 5,
      }),
      this.prisma.transaction.groupBy({
        by: ['category_id'],
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_type: TransactionType.INCOME,
          transaction_date: { gte: start, lte: end },
        },
        _sum: { amount_cents: true },
        orderBy: { _sum: { amount_cents: 'desc' } },
        take: 5,
      }),
    ]);

    const expenseGroups = groupResults[0] as unknown as CategoryGroup[];
    const incomeGroups = groupResults[1] as unknown as CategoryGroup[];

    const allCategoryIds = Array.from(
      new Set([
        ...(expenseGroups ?? []).map((g) => g.category_id).filter(Boolean),
        ...(incomeGroups ?? []).map((g) => g.category_id).filter(Boolean),
      ]),
    ).filter((x): x is string => typeof x === 'string');

    let categoriesById: Record<string, string | null> = {};
    if (allCategoryIds.length > 0) {
      const cats = await this.prisma.category.findMany({
        where: { id: { in: allCategoryIds } },
      });
      categoriesById = (cats || []).reduce(
        (acc: Record<string, string | null>, c: Category) => {
          acc[c.id] = c.name ?? null;
          return acc;
        },
        {},
      );
    }

    const toCategoryTotals = (
      groups: CategoryGroup[] = [],
    ): CategoryTotal[] => {
      if (!groups || groups.length === 0) return [];
      return groups
        .map((g) => ({
          categoryId: g.category_id as string,
          name: categoriesById[g.category_id as string] ?? null,
          total: this.normalizeToNumber(g._sum?.amount_cents ?? 0),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    };

    const topExpenseCategories = toCategoryTotals(expenseGroups ?? []);
    const topIncomeCategories = toCategoryTotals(incomeGroups ?? []);

    return {
      month,
      year,
      summary: {
        income,
        expense,
        netCashFlow: income - expense,
        transactions: txCount ?? 0,
      },
      topExpenseCategories,
      topIncomeCategories,
    };
  }
}
