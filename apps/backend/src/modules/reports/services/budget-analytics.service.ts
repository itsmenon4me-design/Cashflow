import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma, TransactionType } from '@prisma/client';

export interface BudgetCategoryItem {
  categoryId: string;
  categoryName: string | null;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  status: string;
}

export interface BudgetAnalysisResult {
  month: number;
  year: number;
  overall: {
    budget: number;
    spent: number;
    remaining: number;
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
  ): Promise<BudgetRow[]> {
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
        ORDER BY b.budget_amount_cents DESC
      `,
    );
  }

  async analyzeMonth(
    userId: string,
    month: number,
    year: number,
  ): Promise<BudgetAnalysisResult> {
    this.validateMonthYear(month, year);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // budgets
    const budgets = await this.fetchBudgets(userId, month, year);

    // transactions
    const groups = await this.prisma.transaction
      .groupBy({
        by: ['category_id'],
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
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

    const spentByCategory: Record<string, number> = {};

    for (const g of groups as Prisma.TransactionGroupByOutputType[]) {
      spentByCategory[g.category_id] = this.normalizeToNumber(
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
      const budgetAmount = this.normalizeToNumber(b.budget_amount_cents ?? 0);

      const spentAmount = spentByCategory[b.category_id] ?? 0;

      const remainingAmount = Math.max(0, budgetAmount - spentAmount);

      const percentageUsed =
        budgetAmount === 0
          ? 0
          : Number(((spentAmount / budgetAmount) * 100).toFixed(2));

      return {
        categoryId: b.category_id,
        categoryName: categoriesById[b.category_id] ?? null,
        budgetAmount,
        spentAmount,
        remainingAmount,
        percentageUsed,
        status: this.determineStatus(percentageUsed),
      };
    });

    items.sort((a, b) => b.percentageUsed - a.percentageUsed);

    const overallBudget = items.reduce((s, i) => s + i.budgetAmount, 0);

    const overallSpent = items.reduce((s, i) => s + i.spentAmount, 0);

    const overallRemaining = Math.max(0, overallBudget - overallSpent);

    const overallPercentage =
      overallBudget === 0
        ? 0
        : Number(((overallSpent / overallBudget) * 100).toFixed(2));

    return {
      month,
      year,
      overall: {
        budget: overallBudget,
        spent: overallSpent,
        remaining: overallRemaining,
        percentageUsed: overallPercentage,
      },
      categories: items,
    };
  }
}
