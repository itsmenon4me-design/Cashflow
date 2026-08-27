import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma, TransactionType } from '../../../generated/prisma/client';
import { toMinorUnitsExact } from '../../../common/types/money';

export interface BudgetCategoryItem {
  categoryId: string;
  categoryName: string | null;
  /** Exact minor units as strings (BigInt-safe at the API boundary). */
  budgetAmount: string;
  spentAmount: string;
  remainingAmount: string;
  percentageUsed: number;
  status: string;
}

export interface BudgetAnalysisResult {
  month: number;
  year: number;
  overall: {
    budget: string;
    spent: string;
    remaining: string;
    percentageUsed: number;
  };
  categories: BudgetCategoryItem[];
}

interface BudgetRow {
  category_id: string;
  budget_amount_cents: bigint | number | string | null;
}

interface CategoryRow {
  id: string;
  name: string | null;
}

@Injectable()
export class BudgetAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateMonthYear(month: number, year: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Invalid month');
    }

    if (!Number.isInteger(year) || year < 1970 || year > 3000) {
      throw new BadRequestException('Invalid year');
    }
  }

  private determineStatus(percentageUsed: number): string {
    if (percentageUsed > 100) return 'OVER_BUDGET';
    if (percentageUsed >= 80) return 'WARNING';
    return 'SAFE';
  }

  private async fetchBudgets(
    userId: string,
    month: number,
    year: number,
    currency: string,
  ): Promise<BudgetRow[]> {
    const currencyFilter = currency
      ? Prisma.sql`AND b.currency = ${currency}`
      : Prisma.empty;
    return this.prisma.$queryRaw<BudgetRow[]>(
      Prisma.sql`
        SELECT
          b.category_id AS category_id,
          b.budget_amount_cents AS budget_amount_cents
        FROM budgets b
        WHERE b.user_id = ${userId}
          AND b.month = ${month}
          AND b.year = ${year}
          AND b.deleted_at IS NULL
          ${currencyFilter}
        ORDER BY b.budget_amount_cents DESC
      `,
    );
  }

  async analyzeMonth(
    userId: string,
    month: number,
    year: number,
  ): Promise<BudgetAnalysisResult> {
    const m = Number(month);
    const y = Number(year);
    this.validateMonthYear(m, y);

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);

    // Resolve the active ledger currency.
    const accounts = await this.prisma.account.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      select: { currency: true, is_default: true },
    });
    const defaultAcc = accounts.find((a) => a.is_default);
    const targetCurrency = defaultAcc?.currency ?? accounts[0]?.currency ?? 'IDR';

    // budgets (explicit scope only: legacy NULL budgets match any scope)
    const budgets = await this.fetchBudgets(userId, m, y, targetCurrency);

    // transactions
    const groups = await this.prisma.transaction
      .groupBy({
        by: ['category_id'],
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
          account: { currency: targetCurrency },
          // exclude transfer transactions
          transfer_group_id: null,
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
      })
      .catch(() => []);

    const spentByCategory: Record<string, bigint> = {};

    for (const g of groups as Prisma.TransactionGroupByOutputType[]) {
      spentByCategory[g.category_id] = toMinorUnitsExact(
        g._sum?.amount_cents ?? 0,
      );
    }

    const categoryIds = budgets.map((b) => b.category_id).filter(Boolean);

    const categoriesById: Record<string, string | null> = {};

    if (categoryIds.length) {
      const cats = await this.prisma.category
        .findMany({
          where: {
            id: {
              in: categoryIds,
            },
          },
        })
        .catch(() => []);

      for (const c of cats as CategoryRow[]) {
        categoriesById[c.id] = c.name ?? null;
      }
    }

    const items: BudgetCategoryItem[] = budgets.map((b) => {
      const budgetAmount = toMinorUnitsExact(b.budget_amount_cents ?? 0);

      const spentAmount = spentByCategory[b.category_id] ?? 0n;

      const remainingAmount =
        budgetAmount > spentAmount ? budgetAmount - spentAmount : 0n;

      const percentageUsed =
        budgetAmount === 0n
          ? 0
          : Number(
              ((Number(spentAmount) / Number(budgetAmount)) * 100).toFixed(2),
            );

      return {
        categoryId: b.category_id,
        categoryName: categoriesById[b.category_id] ?? null,
        budgetAmount: budgetAmount.toString(),
        spentAmount: spentAmount.toString(),
        remainingAmount: remainingAmount.toString(),
        percentageUsed,
        status: this.determineStatus(percentageUsed),
      };
    });

    items.sort((a, b) => b.percentageUsed - a.percentageUsed);

    const overallBudget = items.reduce(
      (s, i) => s + BigInt(i.budgetAmount),
      0n,
    );

    const overallSpent = items.reduce((s, i) => s + BigInt(i.spentAmount), 0n);

    const overallRemaining =
      overallBudget > overallSpent ? overallBudget - overallSpent : 0n;

    const overallPercentage =
      overallBudget === 0n
        ? 0
        : Number(
            ((Number(overallSpent) / Number(overallBudget)) * 100).toFixed(2),
          );

    return {
      month: m,
      year: y,
      overall: {
        budget: overallBudget.toString(),
        spent: overallSpent.toString(),
        remaining: overallRemaining.toString(),
        percentageUsed: overallPercentage,
      },
      categories: items,
    };
  }
}
