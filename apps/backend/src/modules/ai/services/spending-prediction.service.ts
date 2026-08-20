import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';
import { getCurrencySpec } from '../../../common/types/money';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import {
  CategoryPredictionDto,
  SpendingPredictionResponseDto,
} from '../dto/spending-prediction-response.dto';
import {
  DEFAULT_SPENDING_PREDICTION_HORIZON,
  MAX_SPENDING_PREDICTION_HORIZON,
} from '../dto/spending-prediction-query.dto';

export const DEFAULT_SPENDING_PREDICTION_HISTORY_MONTHS = 6;
export const MIN_TOTAL_POPULATED_MONTHS = 1;
export const MIN_CATEGORY_BASIS_MONTHS = 2;
export const MIN_HIGH_CONFIDENCE_MONTHS = 3;
export const MIN_OUTLIER_SAMPLE = 3;

export interface SpendingPredictionOptions {
  horizon?: number;
  /** Ledger currency scope. When omitted the primary account currency is used. */
  currency?: string;
}

interface MonthRef {
  year: number;
  month: number;
}

interface MonthAmount {
  month: string;
  amount: bigint;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

@Injectable()
export class SpendingPredictionService {
  public clock: () => Date = () => new Date();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Predicts upcoming spending for the next completed calendar month.
   *
   * The response contract represents a single target period, so the primary
   * supported horizon is 1. The prediction is a per-month rate (the weighted
   * average historical monthly spending); for horizon > 1 the same monthly
   * rate applies to every month but only the next month is returned, keeping
   * the single-period contract unchanged.
   */
  async predict(
    userId: string,
    options?: SpendingPredictionOptions,
  ): Promise<SpendingPredictionResponseDto> {
    const rawHorizon = options?.horizon;
    const horizon = Number.isFinite(rawHorizon)
      ? Math.min(
          MAX_SPENDING_PREDICTION_HORIZON,
          Math.max(1, Math.floor(rawHorizon as number)),
        )
      : DEFAULT_SPENDING_PREDICTION_HORIZON;

    const timezone = await this.resolveTimeZone(userId);
    const now = this.clock();
    const cur = this.localYearMonth(now, timezone);
    const periods = this.targetPeriods(cur, horizon);
    const period = periods[0];

    const targetCurrency = await this.resolveTargetCurrency(
      userId,
      options?.currency,
    );

    const windowMonths = this.buildWindowMonths(now, timezone);
    const { monthlyTotal, categoryMonthly } = await this.loadSpendingHistory(
      userId,
      timezone,
      windowMonths,
      targetCurrency,
    );

    const populatedMonths = windowMonths
      .map((m) => this.toPeriod(m))
      .filter((period) => (monthlyTotal.get(period) ?? 0n) > 0n);

    if (populatedMonths.length < MIN_TOTAL_POPULATED_MONTHS) {
      return this.insufficientData(period, targetCurrency);
    }

    const totalSeries = populatedMonths.map((p) => ({
      month: p,
      amount: monthlyTotal.get(p) as bigint,
    }));
    const totalBasis = this.excludeOutliers(totalSeries);
    const predictedTotal = this.weightedAverageAmounts(
      totalBasis.map((b) => b.amount),
    );

    const categoryPredictions = await this.buildCategoryPredictions(
      userId,
      windowMonths,
      categoryMonthly,
    );

    const categorySum = categoryPredictions.reduce(
      (acc, c) => acc + BigInt(c.predictedAmountCents),
      0n,
    );
    const other = predictedTotal - categorySum;
    const otherCents = (other > 0n ? other : 0n).toString();

    const confidence = this.computeTotalConfidence(
      populatedMonths.length,
      totalBasis.map((b) => b.amount),
    );

    return {
      currency: targetCurrency,
      period,
      predictedTotalCents: predictedTotal.toString(),
      confidence,
      categories: categoryPredictions,
      // ponytail: noHistoryCategoryIds stays empty to avoid a full category
      // universe query; new categories simply get no prediction and their
      // spending falls under otherCents. Populate only if a dedicated
      // category-universe endpoint becomes available.
      noHistoryCategoryIds: [],
      otherCents,
      insufficientData: false,
    };
  }

  /**
   * Resolve the prediction currency following the Phase C convention:
   * default account currency OR first available account currency OR 'IDR'.
   *
   * The currency registry (IDR/USD/SGD/EUR) is authoritative. Any other ISO
   * code would make minor units uninterpretable, so it is rejected instead of
   * emitting an ambiguous monetary prediction.
   */
  private async resolveTargetCurrency(
    userId: string,
    preferred?: string,
  ): Promise<string> {
    if (preferred) {
      try {
        getCurrencySpec(preferred);
        return preferred;
      } catch {
        throw ErrorService.create(
          ErrorCode.INVALID_INPUT,
          `Spending prediction does not support currency ${preferred}`,
        );
      }
    }
    const accounts = await this.prisma.account.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { currency: true, is_default: true },
    });
    const defaultAcc = accounts.find((a) => a.is_default);
    const currency = defaultAcc?.currency ?? accounts[0]?.currency ?? 'IDR';
    try {
      getCurrencySpec(currency);
    } catch {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        `Spending prediction does not support currency ${currency}`,
      );
    }
    return currency;
  }

  private async loadSpendingHistory(
    userId: string,
    timezone: string,
    windowMonths: MonthRef[],
    targetCurrency: string,
  ): Promise<{
    monthlyTotal: Map<string, bigint>;
    categoryMonthly: Map<string, Map<string, bigint>>;
  }> {
    const start = this.utcInstantForLocalMonth(
      windowMonths[0].year,
      windowMonths[0].month,
      timezone,
    );
    const afterLast = this.addMonths(
      windowMonths[windowMonths.length - 1].year,
      windowMonths[windowMonths.length - 1].month,
      1,
    );
    const end = this.utcInstantForLocalMonth(
      afterLast.year,
      afterLast.month,
      timezone,
    );

    const recs = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        transfer_group_id: null,
        account: { currency: targetCurrency },
        transaction_date: { gte: start, lt: end },
      },
      select: {
        transaction_date: true,
        transaction_type: true,
        amount_cents: true,
        category_id: true,
        transfer_group_id: true,
      },
    });

    const monthlyTotal = new Map<string, bigint>();
    const categoryMonthly = new Map<string, Map<string, bigint>>();

    for (const r of recs) {
      if (r.transfer_group_id != null) continue;
      if (r.transaction_type !== TransactionType.EXPENSE) continue;
      const amt = r.amount_cents ?? 0n;
      if (amt <= 0n) continue;

      const key = this.localMonthKey(new Date(r.transaction_date), timezone);
      monthlyTotal.set(key, (monthlyTotal.get(key) ?? 0n) + amt);

      const cm =
        categoryMonthly.get(r.category_id) ?? new Map<string, bigint>();
      cm.set(key, (cm.get(key) ?? 0n) + amt);
      categoryMonthly.set(r.category_id, cm);
    }

    return { monthlyTotal, categoryMonthly };
  }

  private async buildCategoryPredictions(
    userId: string,
    windowMonths: MonthRef[],
    categoryMonthly: Map<string, Map<string, bigint>>,
  ): Promise<CategoryPredictionDto[]> {
    const categoryIds = Array.from(categoryMonthly.keys());
    const categories =
      categoryIds.length > 0
        ? await this.prisma.category.findMany({
            where: {
              id: { in: categoryIds },
              user_id: userId,
              deleted_at: null,
            },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    const periods = windowMonths.map((m) => this.toPeriod(m));
    const predictions: CategoryPredictionDto[] = [];

    for (const [categoryId, byMonth] of categoryMonthly) {
      const name = nameById.get(categoryId);
      if (name === undefined) continue;

      const series = periods
        .filter((p) => (byMonth.get(p) ?? 0n) > 0n)
        .map((p) => ({ month: p, amount: byMonth.get(p) as bigint }));

      if (series.length < MIN_CATEGORY_BASIS_MONTHS) continue;

      const basis = this.excludeOutliers(series);
      const amounts = basis.map((b) => b.amount);
      predictions.push({
        categoryId,
        categoryName: name,
        predictedAmountCents: this.weightedAverageAmounts(amounts).toString(),
        confidence: this.computeCategoryConfidence(basis.length, amounts),
        basedOnMonths: basis.length,
      });
    }

    return predictions.sort(
      (a, b) =>
        Number(
          BigInt(b.predictedAmountCents) - BigInt(a.predictedAmountCents),
        ) ||
        (a.categoryId < b.categoryId
          ? -1
          : a.categoryId > b.categoryId
            ? 1
            : 0),
    );
  }

  private excludeOutliers(months: MonthAmount[]): MonthAmount[] {
    if (months.length < MIN_OUTLIER_SAMPLE) return months;

    const values = months.map((m) => Number(m.amount));
    const flagged = new Array<boolean>(values.length).fill(false);

    for (let i = 0; i < values.length; i++) {
      const others = values.filter((_, j) => j !== i);
      const mean = others.reduce((a, b) => a + b, 0) / others.length;
      const variance =
        others.reduce((a, b) => a + (b - mean) * (b - mean), 0) / others.length;
      const sd = Math.max(Math.sqrt(variance), 1);
      if (Math.abs(values[i] - mean) > 3 * sd) {
        flagged[i] = true;
      }
    }

    const basis: MonthAmount[] = [];
    for (let i = 0; i < months.length; i++) {
      if (!flagged[i]) basis.push(months[i]);
    }

    if (basis.length === 0) return months;
    return basis;
  }

  private weightedAverageAmounts(amounts: bigint[]): bigint {
    const n = amounts.length;
    const totalWeight = BigInt((n * (n + 1)) / 2);
    if (totalWeight === 0n) return 0n;
    let num = 0n;
    for (let i = 0; i < n; i++) {
      num += amounts[i] * BigInt(i + 1);
    }
    return num / totalWeight;
  }

  private computeTotalConfidence(
    populatedMonths: number,
    basisValues: bigint[],
  ): number {
    const historyScore = Math.min(
      1,
      populatedMonths / DEFAULT_SPENDING_PREDICTION_HISTORY_MONTHS,
    );
    const missing = Math.max(
      0,
      DEFAULT_SPENDING_PREDICTION_HISTORY_MONTHS - populatedMonths,
    );
    const coverageScore =
      1 - missing / DEFAULT_SPENDING_PREDICTION_HISTORY_MONTHS;
    const stabilityScore = this.stability(basisValues);
    const outliersRemoved = populatedMonths - basisValues.length;
    const outlierPenalty = Math.min(0.25, outliersRemoved * 0.05);

    let confidence =
      0.5 * historyScore +
      0.3 * stabilityScore +
      0.2 * coverageScore -
      outlierPenalty;
    if (populatedMonths === 1) confidence = Math.min(confidence, 0.4);
    if (populatedMonths === 2) confidence = Math.min(confidence, 0.6);

    return Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
  }

  private computeCategoryConfidence(
    basedOnMonths: number,
    values: bigint[],
  ): number {
    const historyScore = Math.min(
      1,
      basedOnMonths / DEFAULT_SPENDING_PREDICTION_HISTORY_MONTHS,
    );
    const stabilityScore = this.stability(values);
    let confidence = 0.5 * historyScore + 0.5 * stabilityScore;
    if (basedOnMonths < MIN_HIGH_CONFIDENCE_MONTHS) {
      confidence = Math.min(confidence, 0.4);
    }
    return Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
  }

  private stability(values: bigint[]): number {
    if (values.length === 0) return 0;
    const nums = values.map((v) => Number(v));
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const variance =
      nums.reduce((a, b) => a + (b - mean) * (b - mean), 0) / nums.length;
    const sd = Math.sqrt(variance);
    const cv = sd / (Math.abs(mean) + 1);
    return 1 / (1 + cv);
  }

  private insufficientData(
    period: string,
    currency: string,
  ): SpendingPredictionResponseDto {
    return {
      currency,
      period,
      predictedTotalCents: '0',
      confidence: 0,
      categories: [],
      noHistoryCategoryIds: [],
      otherCents: '0',
      insufficientData: true,
    };
  }

  private async resolveTimeZone(userId: string): Promise<string> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { user_id: userId },
      select: { timezone: true },
    });
    const candidates = [
      settings?.timezone,
      process.env.APP_DEFAULT_TIMEZONE,
      'UTC',
    ].filter((v): v is string => typeof v === 'string' && v.length > 0);
    for (const tz of candidates) {
      if (this.isValidTimeZone(tz)) return tz;
    }
    return 'UTC';
  }

  private isValidTimeZone(tz: string): boolean {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  private targetPeriods(cur: MonthRef, horizon: number): string[] {
    const periods: string[] = [];
    for (let h = 1; h <= horizon; h++) {
      periods.push(this.toPeriod(this.addMonths(cur.year, cur.month, h)));
    }
    return periods;
  }

  private buildWindowMonths(now: Date, timezone: string): MonthRef[] {
    const cur = this.localYearMonth(now, timezone);
    const months: MonthRef[] = [];
    for (let i = DEFAULT_SPENDING_PREDICTION_HISTORY_MONTHS; i >= 1; i--) {
      months.push(this.addMonths(cur.year, cur.month, -i));
    }
    return months;
  }

  private toPeriod(m: MonthRef): string {
    return `${m.year}-${pad2(m.month)}`;
  }

  private addMonths(year: number, month: number, delta: number): MonthRef {
    const total = year * 12 + (month - 1) + delta;
    return { year: Math.floor(total / 12), month: (total % 12) + 1 };
  }

  private localYearMonth(date: Date, timezone: string): MonthRef {
    const [y, m] = this.formatInTimeZone(date, timezone)
      .slice(0, 7)
      .split('-')
      .map(Number);
    return { year: y, month: m };
  }

  private localMonthKey(date: Date, timezone: string): string {
    return this.formatInTimeZone(date, timezone).slice(0, 7);
  }

  private formatInTimeZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value;
    }
    return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
  }

  private utcInstantForLocalMonth(
    year: number,
    month: number,
    timeZone: string,
  ): Date {
    const target = `${year}-${pad2(month)}-01 00:00:00`;
    const approx = Date.UTC(year, month - 1, 1, 0, 0, 0);
    let low = approx - 24 * 60 * 60 * 1000;
    let high = approx + 24 * 60 * 60 * 1000;
    while (high - low > 1000) {
      const mid = Math.floor((low + high) / 2);
      if (this.formatInTimeZone(new Date(mid), timeZone) < target) {
        low = mid;
      } else {
        high = mid;
      }
    }
    const roundedLow = Math.ceil(low / 1000) * 1000;
    const roundedHigh = Math.floor(high / 1000) * 1000;
    for (let ts = roundedLow; ts <= roundedHigh; ts += 1000) {
      if (this.formatInTimeZone(new Date(ts), timeZone) === target) {
        return new Date(ts);
      }
    }
    throw new Error(
      `Unable to resolve local month start ${target} for timezone ${timeZone}`,
    );
  }
}
