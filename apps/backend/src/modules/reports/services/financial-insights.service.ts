import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Transaction, Category } from '../../../generated/prisma/client';
import { TransactionType } from '../../../generated/prisma/client';
import { normalizeDashboardCurrency } from '../../dashboard/dashboard-currency';
import { formatMoneyFromMinorUnits } from '../../../common/utils/money.utils';

export interface FinancialStatistics {
  averageDailyExpense: number;
  averageMonthlyExpense: number;
  largestTransactionAmount: number | null;
}

interface CategoryGroup {
  category_id?: string | null;
  _sum?: { amount_cents?: number | bigint | string | null } | null;
}

@Injectable()
export class FinancialInsightsService {
  private readonly logger = new Logger(FinancialInsightsService.name);
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

  private percentChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return Number(
      (((current - previous) / Math.abs(previous)) * 100).toFixed(2),
    );
  }

  private formatCurrency(amount: number, currency: string): string {
    // Minor units (cents) rendered with the currency's own locale/precision.
    return formatMoneyFromMinorUnits(Math.round(amount), currency);
  }

  // Resolve the active financial dataset scope so insights never mix currencies.
  private async resolveTargetCurrency(
    userId: string,
    currency?: string,
  ): Promise<string> {
    const normalized = normalizeDashboardCurrency(currency);
    if (normalized) {
      return normalized;
    }

    const accounts = await this.prisma.account.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { currency: true, is_default: true },
    });
    const defaultAcc = accounts.find((a) => a.is_default);
    return defaultAcc?.currency ?? accounts[0]?.currency ?? 'IDR';
  }

  async getInsights(userId: string, month?: number, year?: number, currency?: string) {
    if (
      month !== undefined &&
      (!Number.isInteger(Number(month)) ||
        Number(month) < 1 ||
        Number(month) > 12)
    ) {
      throw new BadRequestException('Invalid month');
    }
    if (
      year !== undefined &&
      (!Number.isInteger(Number(year)) ||
        Number(year) < 1970 ||
        Number(year) > 3000)
    ) {
      throw new BadRequestException('Invalid year');
    }
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);

    // previous month
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);

    const targetCurrency = await this.resolveTargetCurrency(userId, currency);

    const insights: string[] = [];
    const stats: FinancialStatistics = {
      averageDailyExpense: 0,
      averageMonthlyExpense: 0,
      largestTransactionAmount: null,
    };

    try {
      // aggregates
      const [incAgg, expAgg, prevIncAgg, prevExpAgg] = await Promise.all([
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
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.INCOME,
            account: { currency: targetCurrency },
            transaction_date: { gte: prevStart, lte: prevEnd },
          },
          _sum: { amount_cents: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.EXPENSE,
            account: { currency: targetCurrency },
            transaction_date: { gte: prevStart, lte: prevEnd },
          },
          _sum: { amount_cents: true },
        }),
      ]).catch((e) => {
        this.logger.warn('Aggregate failed: ' + String(e));
        return [null, null, null, null];
      });

      const inc = this.normalizeToNumber(incAgg?._sum?.amount_cents ?? 0);
      const exp = this.normalizeToNumber(expAgg?._sum?.amount_cents ?? 0);
      const prevInc = this.normalizeToNumber(
        prevIncAgg?._sum?.amount_cents ?? 0,
      );
      const prevExp = this.normalizeToNumber(
        prevExpAgg?._sum?.amount_cents ?? 0,
      );

      const net = inc - exp;
      const prevNet = prevInc - prevExp;

      const incPct = this.percentChange(inc, prevInc);
      const expPct = this.percentChange(exp, prevExp);

      if (inc !== 0 || prevInc !== 0) {
        if (incPct > 0)
          insights.push(
            `Your income increased by ${incPct}% compared to last month.`,
          );
        else if (incPct < 0)
          insights.push(
            `Your income decreased by ${Math.abs(incPct)}% compared to last month.`,
          );
      }

      if (exp !== 0 || prevExp !== 0) {
        if (expPct > 0)
          insights.push(
            `Your expenses increased by ${expPct}% compared to last month.`,
          );
        else if (expPct < 0)
          insights.push(
            `Your expenses decreased by ${Math.abs(expPct)}% compared to last month.`,
          );
      }

      if (net !== 0 || prevNet !== 0) {
        if (net > prevNet) insights.push('Net cash flow improved this month.');
        else if (net < prevNet)
          insights.push('Net cash flow worsened this month.');
      }

      // highest and lowest spending category in current month
      let groups: CategoryGroup[] = [];
      try {
        const rawGroups = await this.prisma.transaction.groupBy({
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
        });
        groups = rawGroups;
      } catch (e: unknown) {
        this.logger.warn('groupBy failed: ' + String(e));
        groups = [];
      }

      if (groups.length > 0) {
        const highestRaw: unknown = groups[0];
        const lowestRaw: unknown = groups[groups.length - 1];
        const highestId =
          typeof (highestRaw as { category_id?: unknown })?.category_id ===
          'string'
            ? (highestRaw as { category_id: string }).category_id
            : undefined;
        const lowestId =
          typeof (lowestRaw as { category_id?: unknown })?.category_id ===
          'string'
            ? (lowestRaw as { category_id: string }).category_id
            : undefined;
        const catIds = [highestId, lowestId].filter(Boolean) as string[];

        let cats: Category[] = [];
        try {
          cats = await this.prisma.category.findMany({
            where: { id: { in: catIds } },
          });
        } catch (e: unknown) {
          this.logger.warn('category.findMany failed: ' + String(e));
          cats = [];
        }

        const nameById: Record<string, string> = {};
        for (const c of cats) {
          const cat = c;
          nameById[cat.id] = cat.name ?? 'Unknown';
        }
        if (highestId)
          insights.push(
            `Highest expense category is ${nameById[highestId] ?? 'Unknown'}.`,
          );
        if (lowestId)
          insights.push(
            `Lowest expense category is ${nameById[lowestId] ?? 'Unknown'}.`,
          );
      }

      // largest single transaction in month (by absolute amount)
      let largest: Transaction | null = null;
      try {
        largest = await this.prisma.transaction.findFirst({
          where: {
            user_id: userId,
            deleted_at: null,
            account: { currency: targetCurrency },
            transaction_date: { gte: start, lte: end },
          },
          orderBy: { amount_cents: 'desc' },
        });
      } catch (e: unknown) {
        this.logger.warn('findFirst failed: ' + String(e));
        largest = null;
      }
      if (largest) {
        const amt = this.normalizeToNumber(largest.amount_cents ?? 0);
        stats.largestTransactionAmount = amt;
        insights.push(
          `Largest single transaction this month is ${this.formatCurrency(amt, targetCurrency)}.`,
        );
      }

      // average daily spending
      const days = (end.getTime() - start.getTime()) / (24 * 3600 * 1000) + 1;
      stats.averageDailyExpense =
        days > 0 ? Number((exp / days).toFixed(2)) : 0;

      // average monthly spending over last 6 months
      const monthsStart = new Date(
        start.getFullYear(),
        start.getMonth() - 5,
        1,
      );
      const monthsEnd = end;
      // monthlyGroups grouped by exact date; instead compute month buckets
      const monthBuckets: Record<string, number> = {};
      const recs = await this.prisma.transaction
        .findMany({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.EXPENSE,
            account: { currency: targetCurrency },
            transaction_date: { gte: monthsStart, lte: monthsEnd },
          },
          select: { amount_cents: true, transaction_date: true },
        })
        .catch(
          () =>
            [] as Array<{
              amount_cents: number | bigint | string;
              transaction_date: Date;
            }>,
        );
      for (const r of recs) {
        const dt = new Date(r.transaction_date);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        monthBuckets[key] =
          (monthBuckets[key] ?? 0) +
          this.normalizeToNumber(r.amount_cents ?? 0);
      }
      const monthValues = Object.values(monthBuckets);
      if (monthValues.length > 0) {
        const avgMonthly =
          monthValues.reduce((s, v) => s + v, 0) / monthValues.length;
        stats.averageMonthlyExpense = Number(avgMonthly.toFixed(2));
      } else {
        stats.averageMonthlyExpense = 0;
      }
    } catch (err) {
      this.logger.warn('Insight generation failed: ' + String(err));
    }

    return { summary: insights, statistics: stats };
  }
}
