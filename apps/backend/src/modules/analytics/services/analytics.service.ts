import { BadRequestException, Injectable } from '@nestjs/common';
import { DateHelper } from '../../../common/utils/date.util';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';
import { MonthlyReportService } from '../../reports/services/monthly-report.service';
import { CategoryBreakdownService } from '../../reports/services/category-breakdown.service';
import {
  CashflowTrendService,
  type TrendType,
} from '../../reports/services/cashflow-trend.service';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { formatMoneyFromMinorUnits } from '../../../common/utils/money.utils';
import { FIXED_CURRENCY, getCurrencySpec } from '../../../common/currencies';

interface ResolvedRange {
  start: Date;
  end: Date;
  granularity: TrendType;
}

export interface AnalyticsComparison {
  income: number | null;
  expense: number | null;
  netCashFlow: number | null;
  savingRate: number | null;
}

export interface AnalyticsOverviewResult {
  income: string;
  expense: string;
  netCashFlow: string;
  savingRate: number;
  transactions: number;
  comparison: AnalyticsComparison;
}

export interface CategoryRank {
  categoryId: string;
  name: string | null;
  total: string;
  percentage: number;
}

export interface AnalyticsTypeResult {
  total: string;
  transactionCount: number;
  trend: {
    period: string;
    income: string;
    expense: string;
    netCashFlow: string;
  }[];
  categories: {
    categoryId: string;
    categoryName: string | null;
    totalAmount: string;
    percentage: number;
    transactionCount: number;
  }[];
  top: CategoryRank[];
  comparison: number | null;
  biggestCategory: string | null;
  biggestCategoryPercentage: number | null;
}

export interface AnalyticsCashflowResult {
  trend: {
    period: string;
    income: string;
    expense: string;
    netCashFlow: string;
  }[];
  totalIncome: string;
  totalExpense: string;
  netCashFlow: string;
  surplusPeriods: number;
  deficitPeriods: number;
  status: 'surplus' | 'deficit' | 'balanced';
}

export interface AnalyticsSpendingResult {
  avgExpense: string;
  largestExpense: string;
  avgTransaction: string;
  totalTransactions: number;
  incomeTransactions: number;
  expenseTransactions: number;
  byCategory: {
    categoryId: string;
    categoryName: string | null;
    totalAmount: string;
    percentage: number;
    transactionCount: number;
  }[];
}

/**
 * Financial health scoring (deterministic, documented):
 * - savingScore: saving rate mapped 0..100 (negative clipped to 0).
 * - cashflowScore: (netCashFlow/income + 1) / 2 * 100 → 100 at full surplus, 50 breakeven, 0 at loss == income.
 * - diversificationScore: 100 - spendingConcentration (top expense category share).
 * - score = round(0.5 * savingScore + 0.3 * cashflowScore + 0.2 * diversificationScore).
 * - label: >=66 healthy, >=33 moderate, else risk.
 */
export interface AnalyticsHealthResult {
  score: number;
  label: 'healthy' | 'moderate' | 'risk';
  savingRate: number;
  expenseRatio: number;
  incomeVsExpense: number | null;
  netCashFlow: string;
  cashFlowPositive: boolean;
  spendingConcentration: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monthly: MonthlyReportService,
    private readonly categoryBreakdown: CategoryBreakdownService,
    private readonly cashflowTrend: CashflowTrendService,
  ) {}

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

  /** Parse a monetary value that may be a string (from exact-string services) to number. */
  private toNumber(v: string | number | bigint | null | undefined): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private percentChange(current: number, previous: number): number | null {
    if (previous <= 0) return null;
    return this.round(((current - previous) / previous) * 100);
  }

  private resolveRange(query: AnalyticsQueryDto): ResolvedRange {
    const start = DateHelper.startOfDay(query.startDate);
    const end = DateHelper.endOfDay(query.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    let granularity: TrendType = query.granularity ?? 'monthly';
    if (!granularity) {
      granularity = days <= 45 ? 'daily' : days <= 200 ? 'weekly' : 'monthly';
    }
    return { start, end, granularity };
  }

  private previousRange(range: ResolvedRange): ResolvedRange {
    const duration = range.end.getTime() - range.start.getTime();
    const prevEnd = new Date(range.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return {
      start: prevStart,
      end: prevEnd,
      granularity: range.granularity,
    };
  }

  private async getSummary(userId: string, range: ResolvedRange) {
    return this.monthly.getMonthlyReport(userId, undefined, undefined, {
      start: range.start,
      end: range.end,
    });
  }

  private async getBreakdown(
    userId: string,
    type: 'income' | 'expense',
    range: ResolvedRange,
  ) {
    return this.categoryBreakdown.getBreakdown(
      userId,
      type,
      undefined,
      undefined,
      {
        start: range.start,
        end: range.end,
      },
    );
  }

  private async getTrend(userId: string, range: ResolvedRange) {
    const result = await this.cashflowTrend.getTrend(
      userId,
      range.granularity,
      range.start,
      range.end,
    );
    return result.data;
  }

  private toCategoryRanks(
    categories: {
      categoryId: string;
      categoryName: string | null;
      totalAmount: string;
      percentage: number;
    }[],
    total: string,
  ): CategoryRank[] {
    return categories.map((c) => ({
      categoryId: c.categoryId,
      name: c.categoryName ?? null,
      total: c.totalAmount,
      percentage:
        this.toNumber(total) > 0
          ? this.round(
              (this.toNumber(c.totalAmount) / this.toNumber(total)) * 100,
            )
          : 0,
    }));
  }

  async overview(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsOverviewResult> {
    const range = this.resolveRange(query);
    const [summary, prev] = await Promise.all([
      this.getSummary(userId, range),
      this.getSummary(userId, this.previousRange(range)),
    ]);

    const income = summary.summary.income;
    const expense = summary.summary.expense;
    const netCashFlow = summary.summary.netCashFlow;
    const incomeNumber = this.toNumber(income);
    const expenseNumber = this.toNumber(expense);
    const netCashFlowNumber = this.toNumber(netCashFlow);
    const savingRate =
      incomeNumber > 0
        ? this.round(((incomeNumber - expenseNumber) / incomeNumber) * 100)
        : 0;

    const prevIncome = prev.summary.income;
    const prevExpense = prev.summary.expense;
    const prevNet = prev.summary.netCashFlow;
    const prevIncomeNumber = this.toNumber(prevIncome);
    const prevExpenseNumber = this.toNumber(prevExpense);
    const prevNetNumber = this.toNumber(prevNet);
    const prevSaving =
      prevIncomeNumber > 0
        ? this.round(
            ((prevIncomeNumber - prevExpenseNumber) / prevIncomeNumber) * 100,
          )
        : 0;

    return {
      income,
      expense,
      netCashFlow,
      savingRate,
      transactions: this.normalizeToNumber(summary.summary.transactions),
      comparison: {
        income: this.percentChange(incomeNumber, prevIncomeNumber),
        expense: this.percentChange(expenseNumber, prevExpenseNumber),
        netCashFlow: this.percentChange(netCashFlowNumber, prevNetNumber),
        savingRate:
          prevIncomeNumber > 0 || incomeNumber > 0
            ? this.round(savingRate - prevSaving)
            : null,
      },
    };
  }

  async income(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsTypeResult> {
    const range = this.resolveRange(query);
    const [summary, prev, trend, breakdown] = await Promise.all([
      this.getSummary(userId, range),
      this.getSummary(userId, this.previousRange(range)),
      this.getTrend(userId, range),
      this.getBreakdown(userId, 'income', range),
    ]);

    const total = summary.summary.income;
    const prevTotal = prev.summary.income;
    const categories = breakdown.categories;
    const totalNumber = this.toNumber(total);
    const prevTotalNumber = this.toNumber(prevTotal);

    return {
      total,
      transactionCount: categories.reduce(
        (acc, c) => acc + c.transactionCount,
        0,
      ),
      trend,
      categories,
      top: this.toCategoryRanks(categories, total),
      comparison: this.percentChange(totalNumber, prevTotalNumber),
      biggestCategory: categories[0]?.categoryName ?? null,
      biggestCategoryPercentage: categories[0]?.percentage ?? null,
    };
  }

  async expenses(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsTypeResult> {
    const range = this.resolveRange(query);
    const [summary, prev, trend, breakdown] = await Promise.all([
      this.getSummary(userId, range),
      this.getSummary(userId, this.previousRange(range)),
      this.getTrend(userId, range),
      this.getBreakdown(userId, 'expense', range),
    ]);

    const total = summary.summary.expense;
    const prevTotal = prev.summary.expense;
    const categories = breakdown.categories;
    const totalNumber = this.toNumber(total);
    const prevTotalNumber = this.toNumber(prevTotal);

    return {
      total,
      transactionCount: categories.reduce(
        (acc, c) => acc + c.transactionCount,
        0,
      ),
      trend,
      categories,
      top: this.toCategoryRanks(categories, total),
      comparison: this.percentChange(totalNumber, prevTotalNumber),
      biggestCategory: categories[0]?.categoryName ?? null,
      biggestCategoryPercentage: categories[0]?.percentage ?? null,
    };
  }

  async cashflow(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsCashflowResult> {
    const range = this.resolveRange(query);
    const [summary, trend] = await Promise.all([
      this.getSummary(userId, range),
      this.getTrend(userId, range),
    ]);

    const totalIncome = summary.summary.income;
    const totalExpense = summary.summary.expense;
    const netCashFlow = summary.summary.netCashFlow;
    const netCashFlowNumber = this.toNumber(netCashFlow);

    const surplusPeriods = trend.filter(
      (p) => this.toNumber(p.netCashFlow) > 0,
    ).length;
    const deficitPeriods = trend.filter(
      (p) => this.toNumber(p.netCashFlow) < 0,
    ).length;

    return {
      trend,
      totalIncome,
      totalExpense,
      netCashFlow,
      surplusPeriods,
      deficitPeriods,
      status:
        netCashFlowNumber > 0
          ? 'surplus'
          : netCashFlowNumber < 0
            ? 'deficit'
            : 'balanced',
    };
  }

  async spending(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsSpendingResult> {
    const range = this.resolveRange(query);
    const [summary, breakdown, expAgg, incomeCount, expenseCount, totalCount] =
      await Promise.all([
        this.getSummary(userId, range),
        this.getBreakdown(userId, 'expense', range),
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.EXPENSE,
            transaction_date: { gte: range.start, lte: range.end },
          },
          _avg: { amount_cents: true },
          _max: { amount_cents: true },
        }),
        this.prisma.transaction.count({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.INCOME,
            transaction_date: { gte: range.start, lte: range.end },
          },
        }),
        this.prisma.transaction.count({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.EXPENSE,
            transaction_date: { gte: range.start, lte: range.end },
          },
        }),
        this.prisma.transaction.count({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_date: { gte: range.start, lte: range.end },
          },
        }),
      ]);

    const totalExpense = this.toNumber(summary.summary.expense);
    const totalIncome = this.toNumber(summary.summary.income);
    const averageExpense =
      expenseCount > 0 ? this.toNumber(expAgg._avg?.amount_cents ?? 0) : 0;
    const largestExpense = this.toNumber(expAgg._max?.amount_cents ?? 0);
    const averageTransaction =
      totalCount > 0 ? (totalIncome + totalExpense) / totalCount : 0;

    return {
      avgExpense: expenseCount > 0 ? String(Math.round(averageExpense)) : '0',
      largestExpense: String(Math.round(largestExpense)),
      avgTransaction:
        totalCount > 0 ? String(Math.round(averageTransaction)) : '0',
      totalTransactions: totalCount,
      incomeTransactions: incomeCount,
      expenseTransactions: expenseCount,
      byCategory: breakdown.categories,
    };
  }

  async financialHealth(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsHealthResult> {
    const range = this.resolveRange(query);

    // Use overview as a strict source-of-truth for empty-data detection to avoid
    // any discrepancy between different aggregation paths. This is a minimal,
    // safe guard: if overview shows no transactions/income/expense we treat the
    // dataset as empty and return zero health.
    const overviewResult = await this.overview(userId, query);

    // If overview shows truly empty activity, treat dataset as empty.
    if (
      this.toNumber(overviewResult.income) === 0 &&
      this.toNumber(overviewResult.expense) === 0 &&
      this.toNumber(overviewResult.transactions) === 0
    ) {
      return {
        score: 0,
        label: 'risk',
        savingRate: 0,
        expenseRatio: 0,
        incomeVsExpense: null,
        netCashFlow: '0',
        cashFlowPositive: false,
        spendingConcentration: 0,
      };
    }

    const [summary, breakdown] = await Promise.all([
      this.getSummary(userId, range),
      this.getBreakdown(userId, 'expense', range),
    ]);

    const income = this.toNumber(summary.summary.income);
    const expense = this.toNumber(summary.summary.expense);
    const netCashFlow = this.toNumber(summary.summary.netCashFlow);
    const totalExpense = this.toNumber(breakdown.total);
    const transactionsCount = this.toNumber(summary.summary.transactions);

    const isCompletelyEmptyDataset =
      income === 0 &&
      expense === 0 &&
      totalExpense === 0 &&
      transactionsCount === 0 &&
      (!breakdown.categories || breakdown.categories.length === 0);

    if (isCompletelyEmptyDataset) {
      return {
        score: 0,
        label: 'risk',
        savingRate: 0,
        expenseRatio: 0,
        incomeVsExpense: null,
        netCashFlow: '0',
        cashFlowPositive: false,
        spendingConcentration: 0,
      };
    }

    const savingRate =
      income > 0 ? this.round(((income - expense) / income) * 100) : 0;
    const expenseRatio =
      income > 0 ? this.round((expense / income) * 100) : expense > 0 ? 100 : 0;
    const incomeVsExpense = expense > 0 ? this.round(income / expense) : null;

    const concentration =
      totalExpense > 0 && breakdown.categories.length > 0
        ? this.round(
            (this.toNumber(breakdown.categories[0].totalAmount) /
              totalExpense) *
              100,
          )
        : 0;

    const savingScore = this.clamp(savingRate, 0, 100);
    const cashflowScore =
      income > 0
        ? this.clamp(((netCashFlow / income + 1) / 2) * 100, 0, 100)
        : 0;
    const diversificationScore = this.clamp(100 - concentration, 0, 100);
    const score = Math.round(
      0.5 * savingScore + 0.3 * cashflowScore + 0.2 * diversificationScore,
    );
    const label = score >= 66 ? 'healthy' : score >= 33 ? 'moderate' : 'risk';

    return {
      score,
      label,
      savingRate,
      expenseRatio,
      incomeVsExpense,
      netCashFlow: String(Math.round(netCashFlow)),
      cashFlowPositive: netCashFlow >= 0,
      spendingConcentration: concentration,
    };
  }

  async insights(userId: string, query: AnalyticsQueryDto): Promise<string[]> {
    const range = this.resolveRange(query);
    const [summary, prev, breakdown] = await Promise.all([
      this.getSummary(userId, range),
      this.getSummary(userId, this.previousRange(range)),
      this.getBreakdown(userId, 'expense', range),
    ]);

    const income = this.normalizeToNumber(summary.summary.income);
    const expense = this.normalizeToNumber(summary.summary.expense);
    const netCashFlow = this.normalizeToNumber(summary.summary.netCashFlow);
    const txCount = this.normalizeToNumber(summary.summary.transactions);
    const savingRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    const prevIncome = this.normalizeToNumber(prev.summary.income);
    const prevExpense = this.normalizeToNumber(prev.summary.expense);
    const prevSaving =
      prevIncome > 0 ? ((prevIncome - prevExpense) / prevIncome) * 100 : 0;

    const insights: string[] = [];
    if (txCount === 0) return insights;

    const locale = getCurrencySpec(FIXED_CURRENCY).primaryLocale;
    const fmt = (v: number) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
        Math.round(Math.abs(v)),
      );

    if (income > 0 && prevIncome > 0) {
      const change = this.percentChange(income, prevIncome);
      if (change !== null && Math.abs(change) >= 5) {
        insights.push(
          `Pemasukan ${change > 0 ? 'naik' : 'turun'} ${fmt(change)}% dibanding periode sebelumnya.`,
        );
      }
    } else if (income > 0 && prevIncome <= 0) {
      insights.push(
        'Pemasukan tercatat pada periode ini setelah sebelumnya kosong.',
      );
    }

    if (expense > 0 && prevExpense > 0) {
      const change = this.percentChange(expense, prevExpense);
      if (change !== null && Math.abs(change) >= 5) {
        insights.push(
          `Pengeluaran ${change > 0 ? 'naik' : 'turun'} ${fmt(change)}% dibanding periode sebelumnya.`,
        );
      }
    }

    if (expense > 0 && breakdown.categories.length > 0) {
      const top = breakdown.categories[0];
      insights.push(
        `Kategori "${top.categoryName ?? 'Tanpa kategori'}" merupakan pengeluaran terbesar (${top.percentage}% dari total pengeluaran).`,
      );
    }

    if (netCashFlow > 0) {
      insights.push(
        `Arus kas bersih positif sebesar ${formatMoneyFromMinorUnits(Math.round(netCashFlow), FIXED_CURRENCY)}.`,
      );
    } else if (netCashFlow < 0) {
      insights.push(
        `Arus kas bersih negatif sebesar ${formatMoneyFromMinorUnits(Math.round(netCashFlow), FIXED_CURRENCY)}.`,
      );
    }

    if (income > 0 && prevIncome > 0) {
      const delta = Math.round(savingRate - prevSaving);
      if (delta >= 5)
        insights.push(`Saving rate naik ${delta} poin persentase.`);
      else if (delta <= -5)
        insights.push(`Saving rate turun ${Math.abs(delta)} poin persentase.`);
    }

    return insights;
  }
}
