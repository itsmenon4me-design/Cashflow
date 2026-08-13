import {
  ForecastBasisDto,
  ForecastMonthDto,
  ForecastOutlierDto,
  ForecastResponseDto,
} from '../dto/forecast-response.dto';

export const DEFAULT_FORECAST_HISTORY_MONTHS = 6;
export const MIN_POPULATED_MONTHS = 2;
export const MIN_OUTLIER_SAMPLE = 3;
const MAX_WINDOW_MONTHS = 120;

export interface ForecastTransactionInput {
  transactionDate: Date;
  transactionType: 'INCOME' | 'EXPENSE';
  amountCents: bigint;
  transferGroupId: string | null;
}

export interface ForecastWindowMonth {
  year: number;
  month: number;
}

export interface ForecastHistoryWindow {
  months: ForecastWindowMonth[];
  startUtc: Date;
  endUtc: Date;
}

export interface ForecastHistoryWindowOptions {
  startDate?: string;
  endDate?: string;
}

export interface ForecastEngineInput {
  transactions: ForecastTransactionInput[];
  window: ForecastHistoryWindow;
  horizon: number;
  now: Date;
  timezone: string;
  loadCurrentBalance: () => Promise<bigint>;
}

interface PopulatedMonth {
  period: string;
  income: bigint;
  expense: bigint;
  net: bigint;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Deterministic cashflow forecast engine.
 *
 * Pure domain logic: identity-agnostic, no HTTP/controller concerns and no
 * data-access dependency. It consumes normalized transaction rows plus
 * forecasting parameters and returns the forecast result. Data access is
 * injected through the `loadCurrentBalance` seam and is only invoked when the
 * historical basis is sufficient for a projection.
 */
export class ForecastEngine {
  buildHistoryWindow(
    now: Date,
    timezone: string,
    options?: ForecastHistoryWindowOptions,
  ): ForecastHistoryWindow {
    const cur = this.localYearMonth(now, timezone);
    const lastCompleted = this.addMonths(cur.year, cur.month, -1);

    const startRaw = options?.startDate
      ? new Date(options.startDate)
      : new Date(NaN);
    const start =
      startRaw && !Number.isNaN(startRaw.getTime())
        ? this.localYearMonth(startRaw, timezone)
        : this.addMonths(cur.year, cur.month, -DEFAULT_FORECAST_HISTORY_MONTHS);

    const endRaw = options?.endDate ? new Date(options.endDate) : new Date(NaN);
    let end =
      endRaw && !Number.isNaN(endRaw.getTime())
        ? this.localYearMonth(endRaw, timezone)
        : lastCompleted;
    if (this.cmpMonth(end, lastCompleted) > 0) end = lastCompleted;
    if (this.cmpMonth(start, end) > 0) {
      return { months: [], startUtc: new Date(NaN), endUtc: new Date(NaN) };
    }

    const months: ForecastWindowMonth[] = [];
    let m = { ...start };
    let guard = 0;
    while (this.cmpMonth(m, end) <= 0 && guard < MAX_WINDOW_MONTHS) {
      months.push(m);
      m = this.addMonths(m.year, m.month, 1);
      guard += 1;
    }

    const afterLast = this.addMonths(end.year, end.month, 1);
    return {
      months,
      startUtc: this.utcInstantForLocalMonth(start.year, start.month, timezone),
      endUtc: this.utcInstantForLocalMonth(
        afterLast.year,
        afterLast.month,
        timezone,
      ),
    };
  }

  async forecast(
    input: ForecastEngineInput,
  ): Promise<Omit<ForecastResponseDto, 'currency'>> {
    const { transactions, window, horizon, now, timezone } = input;
    const populated = this.aggregateMonths(transactions, window, timezone);

    if (populated.length < MIN_POPULATED_MONTHS) {
      return this.insufficientData(horizon, window.months);
    }

    const { basis, outliers } = this.excludeOutliers(populated);
    const { avgIncome, avgExpense } = this.weightedAverage(basis);
    const currentBalance = await input.loadCurrentBalance();

    const months = this.project(
      now,
      timezone,
      horizon,
      currentBalance,
      avgIncome,
      avgExpense,
    );
    const confidence = this.computeConfidence(
      populated,
      basis,
      outliers,
      window.months.length,
    );

    return {
      horizon,
      months,
      confidence,
      basis: {
        monthsUsed: basis.length,
        historyStart: window.months.length
          ? this.toPeriod(window.months[0])
          : '',
        historyEnd: window.months.length
          ? this.toPeriod(window.months[window.months.length - 1])
          : '',
        totalIncomeCents: this.sumOf(basis, 'income').toString(),
        totalExpenseCents: this.sumOf(basis, 'expense').toString(),
        averageMonthlyIncomeCents: avgIncome.toString(),
        averageMonthlyExpenseCents: avgExpense.toString(),
      },
      excludedTransfers: true,
      outliers,
      insufficientData: false,
    };
  }

  private aggregateMonths(
    transactions: ForecastTransactionInput[],
    window: ForecastHistoryWindow,
    timezone: string,
  ): PopulatedMonth[] {
    const byMonth = new Map<string, { income: bigint; expense: bigint }>();
    for (const tx of transactions) {
      if (tx.transferGroupId != null) continue;
      const key = this.localMonthKey(tx.transactionDate, timezone);
      const entry = byMonth.get(key) ?? { income: 0n, expense: 0n };
      if (tx.transactionType === 'INCOME') {
        entry.income += tx.amountCents;
      } else {
        entry.expense += tx.amountCents;
      }
      byMonth.set(key, entry);
    }

    const populated: PopulatedMonth[] = [];
    for (const m of window.months) {
      const period = this.toPeriod(m);
      const entry = byMonth.get(period);
      if (entry) {
        populated.push({
          period,
          income: entry.income,
          expense: entry.expense,
          net: entry.income - entry.expense,
        });
      }
    }
    return populated;
  }

  private excludeOutliers(populated: PopulatedMonth[]): {
    basis: PopulatedMonth[];
    outliers: ForecastOutlierDto[];
  } {
    if (populated.length < MIN_OUTLIER_SAMPLE) {
      return { basis: populated, outliers: [] };
    }

    const nets = populated.map((p) => Number(p.net));
    const flagged = new Array<boolean>(nets.length).fill(false);

    for (let i = 0; i < nets.length; i++) {
      const others = nets.filter((_, j) => j !== i);
      const mean = others.reduce((a, b) => a + b, 0) / others.length;
      const variance =
        others.reduce((a, b) => a + (b - mean) * (b - mean), 0) / others.length;
      const sd = Math.max(Math.sqrt(variance), 1);
      if (Math.abs(nets[i] - mean) > 3 * sd) {
        flagged[i] = true;
      }
    }

    const outliers: ForecastOutlierDto[] = [];
    const basis: PopulatedMonth[] = [];
    for (let i = 0; i < populated.length; i++) {
      if (flagged[i]) {
        outliers.push({
          period: populated[i].period,
          amountCents: populated[i].net.toString(),
        });
      } else {
        basis.push(populated[i]);
      }
    }

    if (basis.length === 0) return { basis: populated, outliers: [] };
    return { basis, outliers };
  }

  private weightedAverage(basis: PopulatedMonth[]): {
    avgIncome: bigint;
    avgExpense: bigint;
  } {
    const n = basis.length;
    const totalWeight = BigInt((n * (n + 1)) / 2);
    if (totalWeight === 0n) return { avgIncome: 0n, avgExpense: 0n };

    let incomeNum = 0n;
    let expenseNum = 0n;
    for (let i = 0; i < n; i++) {
      const w = BigInt(i + 1);
      incomeNum += basis[i].income * w;
      expenseNum += basis[i].expense * w;
    }
    return {
      avgIncome: incomeNum / totalWeight,
      avgExpense: expenseNum / totalWeight,
    };
  }

  private project(
    now: Date,
    timezone: string,
    horizon: number,
    currentBalance: bigint,
    avgIncome: bigint,
    avgExpense: bigint,
  ): ForecastMonthDto[] {
    const cur = this.localYearMonth(now, timezone);
    const months: ForecastMonthDto[] = [];
    let cumulative = 0n;
    for (let h = 1; h <= horizon; h++) {
      const m = this.addMonths(cur.year, cur.month, h);
      cumulative += avgIncome - avgExpense;
      months.push({
        period: this.toPeriod(m),
        projectedIncomeCents: avgIncome.toString(),
        projectedExpenseCents: avgExpense.toString(),
        projectedNetCashflowCents: (avgIncome - avgExpense).toString(),
        projectedEndingBalanceCents: (currentBalance + cumulative).toString(),
      });
    }
    return months;
  }

  private computeConfidence(
    populated: PopulatedMonth[],
    basis: PopulatedMonth[],
    outliers: ForecastOutlierDto[],
    windowSize: number,
  ): number {
    const historyScore = Math.min(
      1,
      basis.length / DEFAULT_FORECAST_HISTORY_MONTHS,
    );
    const missingFraction =
      Math.max(0, windowSize - populated.length) / Math.max(1, windowSize);
    const coverageScore = 1 - missingFraction;

    const nets = basis.map((p) => Number(p.net));
    const mean = nets.length
      ? nets.reduce((a, b) => a + b, 0) / nets.length
      : 0;
    const variance = nets.length
      ? nets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / nets.length
      : 0;
    const sd = Math.sqrt(variance);
    const cv = sd / (Math.abs(mean) + 1);
    const stabilityScore = 1 / (1 + cv);

    const outlierPenalty = Math.min(0.25, outliers.length * 0.05);
    const confidence =
      0.5 * historyScore +
      0.3 * stabilityScore +
      0.2 * coverageScore -
      outlierPenalty;
    return Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
  }

  private sumOf(months: PopulatedMonth[], field: 'income' | 'expense'): bigint {
    return months.reduce((acc, m) => acc + m[field], 0n);
  }

  private insufficientData(
    horizon: number,
    windowMonths: ForecastWindowMonth[],
  ): Omit<ForecastResponseDto, 'currency'> {
    const basis: ForecastBasisDto = {
      monthsUsed: 0,
      historyStart: windowMonths.length ? this.toPeriod(windowMonths[0]) : '',
      historyEnd: windowMonths.length
        ? this.toPeriod(windowMonths[windowMonths.length - 1])
        : '',
      totalIncomeCents: '0',
      totalExpenseCents: '0',
      averageMonthlyIncomeCents: '0',
      averageMonthlyExpenseCents: '0',
    };
    return {
      horizon,
      months: [],
      confidence: 0,
      basis,
      excludedTransfers: true,
      outliers: [],
      insufficientData: true,
    };
  }

  private toPeriod(m: ForecastWindowMonth): string {
    return `${m.year}-${pad2(m.month)}`;
  }

  private cmpMonth(a: ForecastWindowMonth, b: ForecastWindowMonth): number {
    return a.year * 12 + a.month - (b.year * 12 + b.month);
  }

  private addMonths(
    year: number,
    month: number,
    delta: number,
  ): ForecastWindowMonth {
    const total = year * 12 + (month - 1) + delta;
    return { year: Math.floor(total / 12), month: (total % 12) + 1 };
  }

  private localYearMonth(date: Date, timezone: string): ForecastWindowMonth {
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
