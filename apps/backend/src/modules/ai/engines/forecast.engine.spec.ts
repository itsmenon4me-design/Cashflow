import {
  ForecastEngine,
  ForecastHistoryWindow,
  ForecastTransactionInput,
} from './forecast.engine';

const FIXED_NOW = new Date('2026-05-15T00:00:00Z');
const MONTHS = [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
];

const makeTx = (
  date: string,
  type: 'INCOME' | 'EXPENSE',
  cents: number | bigint,
): ForecastTransactionInput => ({
  transactionDate: new Date(date),
  transactionType: type,
  amountCents: BigInt(cents),
});

const seedStable = (
  income: number,
  expense: number,
): ForecastTransactionInput[] =>
  MONTHS.flatMap((period) => [
    makeTx(`${period}-15T12:00:00Z`, 'INCOME', income),
    makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', expense),
  ]);

const seedTrend = (
  incomes: number[],
  expenses: number[],
): ForecastTransactionInput[] =>
  MONTHS.map((period, i) => [
    makeTx(`${period}-15T12:00:00Z`, 'INCOME', incomes[i]),
    makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', expenses[i]),
  ]).flat();

const engine = new ForecastEngine();

const windowOf = (timezone = 'UTC'): ForecastHistoryWindow =>
  engine.buildHistoryWindow(FIXED_NOW, timezone);

const run = async (
  transactions: ForecastTransactionInput[],
  options: {
    horizon?: number;
    balance?: bigint;
    timezone?: string;
    window?: ForecastHistoryWindow;
  } = {},
) => {
  const balanceLoader = jest
    .fn<Promise<bigint>, []>()
    .mockResolvedValue(options.balance ?? 100000n);
  const result = await engine.forecast({
    transactions,
    window: options.window ?? windowOf(options.timezone ?? 'UTC'),
    horizon: options.horizon ?? 3,
    now: FIXED_NOW,
    timezone: options.timezone ?? 'UTC',
    loadCurrentBalance: balanceLoader,
  });
  return { result, balanceLoader };
};

describe('ForecastEngine', () => {
  it('forecasts from a normal 6-month history', async () => {
    const { result } = await run(seedStable(2000000, 1000000));

    expect(result.insufficientData).toBe(false);
    expect(result.horizon).toBe(3);
    expect(result.months.map((m) => m.period)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
    expect(result.basis.monthsUsed).toBe(6);
    expect(result.basis.historyStart).toBe('2025-11');
    expect(result.basis.historyEnd).toBe('2026-04');
    expect(result.basis.totalIncomeCents).toBe('12000000');
    expect(result.basis.totalExpenseCents).toBe('6000000');
    expect(result.months[0].projectedIncomeCents).toBe('2000000');
    expect(result.months[0].projectedExpenseCents).toBe('1000000');
    expect(result.months[0].projectedNetCashflowCents).toBe('1000000');
    expect(result.months[0].projectedEndingBalanceCents).toBe('1100000');
  });

  it('captures an increasing income trend through recency weighting', async () => {
    const incomes = [1000000, 2000000, 3000000, 4000000, 5000000, 6000000];
    const { result } = await run(
      seedTrend(
        incomes,
        incomes.map(() => 1000000),
      ),
    );

    const weightedAvg =
      incomes.reduce((sum, value, i) => sum + value * (i + 1), 0) / 21;
    expect(result.months[0].projectedIncomeCents).toBe(
      String(Math.floor(weightedAvg)),
    );
    expect(Number(result.months[0].projectedIncomeCents)).toBeGreaterThan(
      4000000,
    );
  });

  it('captures an increasing expense trend through recency weighting', async () => {
    const expenses = [1000000, 2000000, 3000000, 4000000, 5000000, 6000000];
    const { result } = await run(
      seedTrend(
        expenses.map(() => 4000000),
        expenses,
      ),
    );

    const weightedAvg =
      expenses.reduce((sum, value, i) => sum + value * (i + 1), 0) / 21;
    expect(result.months[0].projectedExpenseCents).toBe(
      String(Math.floor(weightedAvg)),
    );
    expect(Number(result.months[0].projectedExpenseCents)).toBeGreaterThan(
      4000000,
    );
  });

  it('captures a declining income trend through recency weighting', async () => {
    const incomes = [6000000, 5000000, 4000000, 3000000, 2000000, 1000000];
    const { result } = await run(
      seedTrend(
        incomes,
        incomes.map(() => 1000000),
      ),
    );

    const weightedAvg =
      incomes.reduce((sum, value, i) => sum + value * (i + 1), 0) / 21;
    expect(result.months[0].projectedIncomeCents).toBe(
      String(Math.floor(weightedAvg)),
    );
    expect(Number(result.months[0].projectedIncomeCents)).toBeLessThan(3000000);
  });

  it('projects a positive net cashflow', async () => {
    const { result } = await run(seedStable(2000000, 1000000));

    expect(result.months[0].projectedNetCashflowCents).toBe('1000000');
    expect(result.months[0].projectedEndingBalanceCents).toBe('1100000');
    expect(result.months[2].projectedEndingBalanceCents).toBe('3100000');
  });

  it('projects a negative net cashflow', async () => {
    const { result } = await run(seedStable(1000000, 3000000));

    expect(result.months[0].projectedNetCashflowCents).toBe('-2000000');
    expect(result.months[0].projectedEndingBalanceCents).toBe('-1900000');
  });

  it('handles a zero-income history', async () => {
    const { result } = await run(
      MONTHS.map((p) => makeTx(`${p}-15T12:00:00Z`, 'EXPENSE', 1000000)),
    );

    expect(result.insufficientData).toBe(false);
    expect(result.months[0].projectedIncomeCents).toBe('0');
    expect(result.months[0].projectedExpenseCents).toBe('1000000');
    expect(result.months[0].projectedNetCashflowCents).toBe('-1000000');
  });

  it('handles a zero-expense history', async () => {
    const { result } = await run(
      MONTHS.map((p) => makeTx(`${p}-15T12:00:00Z`, 'INCOME', 1000000)),
    );

    expect(result.months[0].projectedExpenseCents).toBe('0');
    expect(result.months[0].projectedIncomeCents).toBe('1000000');
    expect(result.months[0].projectedEndingBalanceCents).toBe('1100000');
  });

  it('returns insufficientData for empty input and never loads balance', async () => {
    const { result, balanceLoader } = await run([]);

    expect(result.insufficientData).toBe(true);
    expect(result.months).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(balanceLoader).not.toHaveBeenCalled();
  });

  it('returns insufficientData for a single populated month', async () => {
    const { result, balanceLoader } = await run([
      makeTx('2026-04-15T12:00:00Z', 'EXPENSE', 500000),
    ]);

    expect(result.insufficientData).toBe(true);
    expect(result.months).toEqual([]);
    expect(balanceLoader).not.toHaveBeenCalled();
  });

  it('does not dilute the average with missing periods', async () => {
    const { result } = await run(
      MONTHS.slice(4).flatMap((period) => [
        makeTx(`${period}-15T12:00:00Z`, 'INCOME', 2000000),
        makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', 1000000),
      ]),
    );

    expect(result.insufficientData).toBe(false);
    expect(result.basis.monthsUsed).toBe(2);
    expect(result.basis.averageMonthlyIncomeCents).toBe('2000000');
    expect(result.basis.averageMonthlyExpenseCents).toBe('1000000');
    expect(result.basis.totalIncomeCents).toBe('4000000');
  });

  it('flags and excludes a 3-sigma outlier month', async () => {
    const txs = MONTHS.flatMap((period) => {
      const expense = period === '2026-02' ? 200000000 : 1000000;
      return [
        makeTx(`${period}-15T12:00:00Z`, 'INCOME', 2000000),
        makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', expense),
      ];
    });

    const { result } = await run(txs);

    expect(result.outliers).toHaveLength(1);
    expect(result.outliers[0].period).toBe('2026-02');
    expect(result.basis.monthsUsed).toBe(5);
    expect(result.months[0].projectedExpenseCents).toBe('1000000');
  });

  it('includes all transactions in the aggregation', async () => {
    const txs = seedStable(2000000, 1000000);
    txs.push(
      makeTx('2026-04-15T12:00:00Z', 'EXPENSE', 999999999),
      makeTx('2026-04-15T12:00:00Z', 'INCOME', 999999999),
    );

    const { result } = await run(txs);

    expect(result.basis.totalIncomeCents).toBe('1011999999');
    expect(result.basis.totalExpenseCents).toBe('1005999999');
  });

  it('accumulates the projected ending balance across the horizon', async () => {
    const { result } = await run(seedStable(2000000, 1000000), {
      balance: 5000000n,
      horizon: 2,
    });

    expect(result.months[0].projectedEndingBalanceCents).toBe('6000000');
    expect(result.months[1].projectedEndingBalanceCents).toBe('7000000');
  });

  it('preserves exact precision for large money values', async () => {
    const big = 9007199254740993n;
    const { result } = await run(
      MONTHS.flatMap((period) => [
        makeTx(`${period}-15T12:00:00Z`, 'INCOME', big),
        makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', 1000000),
      ]),
    );

    expect(result.basis.totalIncomeCents).toBe((big * 6n).toString());
    expect(result.months[0].projectedIncomeCents).toBe(big.toString());
    expect(result.basis.totalExpenseCents).toBe('6000000');
  });

  it('is deterministic for identical input', async () => {
    const tx = seedStable(2000000, 1000000);
    const a = await run(tx);
    const b = await run(tx);

    expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result));
  });

  it('loads the balance only when history is sufficient', async () => {
    const { balanceLoader } = await run(seedStable(2000000, 1000000));
    expect(balanceLoader).toHaveBeenCalledTimes(1);

    const insufficient = await run([]);
    expect(insufficient.balanceLoader).not.toHaveBeenCalled();
  });

  it('projects a zero net cashflow when income equals expense', async () => {
    const { result } = await run(seedStable(2000000, 2000000), {
      balance: 500000n,
    });

    expect(result.months[0].projectedNetCashflowCents).toBe('0');
    expect(result.months[0].projectedEndingBalanceCents).toBe('500000');
    expect(result.months[2].projectedEndingBalanceCents).toBe('500000');
  });

  it('captures a declining expense trend through recency weighting', async () => {
    const expenses = [6000000, 5000000, 4000000, 3000000, 2000000, 1000000];
    const { result } = await run(
      seedTrend(
        expenses.map(() => 4000000),
        expenses,
      ),
    );

    const weightedAvg =
      expenses.reduce((sum, value, i) => sum + value * (i + 1), 0) / 21;
    expect(result.months[0].projectedExpenseCents).toBe(
      String(Math.floor(weightedAvg)),
    );
    expect(Number(result.months[0].projectedExpenseCents)).toBeLessThan(
      3000000,
    );
  });

  it('aggregates multiple transactions within the same month', async () => {
    const txs = [
      makeTx('2026-03-15T07:00:00Z', 'INCOME', 1000000),
      makeTx('2026-03-15T12:00:00Z', 'INCOME', 500000),
      makeTx('2026-03-16T12:00:00Z', 'EXPENSE', 200000),
      makeTx('2026-03-16T18:00:00Z', 'EXPENSE', 300000),
      makeTx('2026-04-10T12:00:00Z', 'INCOME', 2000000),
      makeTx('2026-04-10T12:00:00Z', 'EXPENSE', 400000),
    ];

    const { result } = await run(txs, { horizon: 1 });

    expect(result.basis.monthsUsed).toBe(2);
    expect(result.basis.totalIncomeCents).toBe('3500000');
    expect(result.basis.totalExpenseCents).toBe('900000');
    expect(result.months[0].projectedIncomeCents).toBe('1833333');
    expect(result.months[0].projectedExpenseCents).toBe('433333');
  });

  it('keeps 1,000,000 IDR as 1,000,000 (never scales by 100)', async () => {
    const { result } = await run(seedStable(1000000, 1000000), {
      balance: 0n,
    });

    expect(result.basis.totalIncomeCents).toBe('6000000');
    expect(result.basis.totalExpenseCents).toBe('6000000');
    expect(result.months[0].projectedIncomeCents).toBe('1000000');
    expect(result.months[0].projectedExpenseCents).toBe('1000000');
    expect(result.months[0].projectedNetCashflowCents).toBe('0');
  });

  it('treats USD cents as cents: 1.23 stays 123, never 1 or 12300', async () => {
    const { result } = await run(seedStable(123, 107), {
      balance: 100000n,
      horizon: 1,
    });

    expect(result.months[0].projectedIncomeCents).toBe('123');
    expect(result.months[0].projectedExpenseCents).toBe('107');
    expect(result.months[0].projectedNetCashflowCents).toBe('16');
    expect(result.months[0].projectedEndingBalanceCents).toBe('100016');
  });

  it('buckets transactions by timezone month boundaries', async () => {
    const txs = [
      makeTx('2026-03-31T16:59:59Z', 'EXPENSE', 1000),
      makeTx('2026-03-31T17:00:00Z', 'INCOME', 2000),
      makeTx('2026-04-01T00:00:00Z', 'EXPENSE', 3000),
    ];

    const { result } = await run(txs, { timezone: 'Asia/Jakarta', horizon: 2 });

    expect(result.basis.monthsUsed).toBe(2);
    expect(result.basis.totalIncomeCents).toBe('2000');
    expect(result.basis.totalExpenseCents).toBe('4000');
  });

  it('produces only the documented contract fields with string money values', async () => {
    const { result } = await run(seedStable(2000000, 1000000));

    expect(Object.keys(result).sort()).toEqual([
      'basis',
      'confidence',
      'horizon',
      'insufficientData',
      'months',
      'outliers',
    ]);
    expect(Object.keys(result.months[0]).sort()).toEqual([
      'period',
      'projectedEndingBalanceCents',
      'projectedExpenseCents',
      'projectedIncomeCents',
      'projectedNetCashflowCents',
    ]);
    expect(Object.keys(result.basis).sort()).toEqual([
      'averageMonthlyExpenseCents',
      'averageMonthlyIncomeCents',
      'historyEnd',
      'historyStart',
      'monthsUsed',
      'totalExpenseCents',
      'totalIncomeCents',
    ]);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.confidence).not.toBeNaN();
  });
});
