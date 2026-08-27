import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';
import type { Category } from '../../../generated/prisma/client';
import { toMinorUnitsExact } from '../../../common/types/money';

interface CategoryGroup {
  category_id?: string | null;
  _sum?: { amount_cents?: number | bigint | string | null } | null;
}

export interface CategoryTotal {
  categoryId: string;
  name: string | null;
  /** Exact minor units as a string (BigInt-safe at the API boundary). */
  total: string;
}

export interface MonthlyReportResult {
  month: number;
  year: number;
  summary: {
    income: string;
    expense: string;
    netCashFlow: string;
    transactions: number;
  };
  topExpenseCategories: CategoryTotal[];
  topIncomeCategories: CategoryTotal[];
}

@Injectable()
export class MonthlyReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTargetCurrency(userId: string): Promise<string> {
    const accounts = await this.prisma.account.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { currency: true, is_default: true },
    });
    const defaultAcc = accounts.find((a) => a.is_default);
    return defaultAcc?.currency ?? accounts[0]?.currency ?? 'IDR';
  }

  private validateMonthYear(month: number, year: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12)
      throw new BadRequestException('Invalid month');
    if (!Number.isInteger(year) || year < 1970 || year > 3000)
      throw new BadRequestException('Invalid year');
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

  async getMonthlyReport(
    userId: string,
    month?: number | string,
    year?: number | string,
    range?: { start?: Date; end?: Date },
  ): Promise<MonthlyReportResult> {
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

    const targetCurrency = await this.resolveTargetCurrency(userId);

    // aggregates income and expense (single currency only)
    const [incAgg, expAgg, txCount] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_type: TransactionType.INCOME,
          account: { currency: targetCurrency },
          transaction_date: { gte: start, lte: end },
        },
        _sum: { amount_cents: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
          account: { currency: targetCurrency },
          transaction_date: { gte: start, lte: end },
        },
        _sum: { amount_cents: true },
      }),
      this.prisma.transaction.count({
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_date: { gte: start, lte: end },
          account: { currency: targetCurrency },
        },
      }),
    ]);

    const income = toMinorUnitsExact(incAgg._sum?.amount_cents);
    const expense = toMinorUnitsExact(expAgg._sum?.amount_cents);
    const netCashFlow = income - expense;

    // top categories using groupBy
    const groupResults = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['category_id'],
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
          account: { currency: targetCurrency },
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
          account: { currency: targetCurrency },
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
          total: toMinorUnitsExact(g._sum?.amount_cents).toString(),
        }))
        .sort((a, b) => {
          const diff = BigInt(b.total) - BigInt(a.total);
          return diff > 0n ? 1 : diff < 0n ? -1 : 0;
        })
        .slice(0, 5);
    };

    const topExpenseCategories = toCategoryTotals(expenseGroups ?? []);
    const topIncomeCategories = toCategoryTotals(incomeGroups ?? []);

    return {
      month: start.getMonth() + 1,
      year: start.getFullYear(),
      summary: {
        income: income.toString(),
        expense: expense.toString(),
        netCashFlow: netCashFlow.toString(),
        transactions: txCount ?? 0,
      },
      topExpenseCategories,
      topIncomeCategories,
    };
  }
}
