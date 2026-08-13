import { ForecastService } from './forecast.service';
import type { PrismaService } from '../../../database/prisma.service';

const FIXED_NOW = new Date('2026-05-15T00:00:00Z');
const MONTHS = [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
];

type TxRecord = {
  id: string;
  user_id: string;
  transaction_type: 'INCOME' | 'EXPENSE';
  amount_cents: bigint;
  transaction_date: Date;
  transfer_group_id: string | null;
};

type TxQuery = {
  where: {
    user_id: string;
    deleted_at: null;
    transfer_group_id: null;
    account?: { currency: string };
    transaction_date: { gte: Date; lt: Date };
  };
};

type BalanceQuery = {
  where: { user_id: string; deleted_at: null };
  _sum: { current_balance_cents: true };
};

const makeTx = (
  date: string,
  type: 'INCOME' | 'EXPENSE',
  cents: number | bigint,
  transferGroupId: string | null = null,
): TxRecord => ({
  id: `tx-${date}-${type}-${cents}`,
  user_id: 'u1',
  transaction_type: type,
  amount_cents: BigInt(cents),
  transaction_date: new Date(date),
  transfer_group_id: transferGroupId,
});

const seedStable = (income: number, expense: number): TxRecord[] =>
  MONTHS.flatMap((period) => [
    makeTx(`${period}-15T12:00:00Z`, 'INCOME', income),
    makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', expense),
  ]);

const makeFindMany = (rows: TxRecord[]) =>
  jest.fn<Promise<TxRecord[]>, [TxQuery]>().mockResolvedValue(rows);

const makeBalanceAgg = (value: bigint) =>
  jest
    .fn<
      Promise<{ _sum: { current_balance_cents: bigint | null } }>,
      [BalanceQuery]
    >()
    .mockResolvedValue({ _sum: { current_balance_cents: value } });

type PrismaMock = {
  userSettings: { findUnique: jest.Mock };
  transaction: { findMany: ReturnType<typeof makeFindMany> };
  account: {
    findMany: jest.Mock;
    aggregate: ReturnType<typeof makeBalanceAgg>;
  };
};

const makeService = (overrides?: Partial<PrismaMock>) => {
  const prisma = {
    userSettings: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
    },
    transaction: { findMany: makeFindMany([]) },
    account: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ currency: 'IDR', is_default: true }]),
      aggregate: makeBalanceAgg(100000n),
    },
    ...overrides,
  };
  const service = new ForecastService(prisma as unknown as PrismaService);
  service.clock = () => new Date(FIXED_NOW.getTime());
  return { service, prisma };
};

describe('ForecastService', () => {
  it('forecasts from a normal 6-month history', async () => {
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.insufficientData).toBe(false);
    expect(res.currency).toBe('IDR');
    expect(res.horizon).toBe(3);
    expect(res.months.map((m) => m.period)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
    expect(res.basis.monthsUsed).toBe(6);
    expect(res.basis.historyStart).toBe('2025-11');
    expect(res.basis.historyEnd).toBe('2026-04');
    expect(res.basis.totalIncomeCents).toBe('12000000');
    expect(res.basis.totalExpenseCents).toBe('6000000');
    expect(res.basis.averageMonthlyIncomeCents).toBe('2000000');
    expect(res.basis.averageMonthlyExpenseCents).toBe('1000000');
    expect(res.months[0].projectedIncomeCents).toBe('2000000');
    expect(res.months[0].projectedExpenseCents).toBe('1000000');
    expect(res.months[0].projectedNetCashflowCents).toBe('1000000');
    expect(res.months[0].projectedEndingBalanceCents).toBe('1100000');
    expect(res.months[1].projectedEndingBalanceCents).toBe('2100000');
    expect(res.excludedTransfers).toBe(true);
    expect(res.outliers).toEqual([]);
    expect(res.confidence).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeLessThanOrEqual(1);

    const [balQuery] = prisma.account.aggregate.mock.calls[0];
    expect(balQuery.where.user_id).toBe('u1');
  });

  it('returns insufficientData for an empty history', async () => {
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany([]) },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.insufficientData).toBe(true);
    expect(res.currency).toBe('IDR');
    expect(res.months).toEqual([]);
    expect(res.confidence).toBe(0);
    expect(res.confidence).not.toBeNaN();
    expect(res.basis.monthsUsed).toBe(0);
    expect(res.basis.totalIncomeCents).toBe('0');
    expect(res.basis.totalExpenseCents).toBe('0');
    expect(res.basis.averageMonthlyIncomeCents).toBe('0');
    expect(res.basis.averageMonthlyExpenseCents).toBe('0');
    expect(res.basis.historyStart).toBe('2025-11');
    expect(res.basis.historyEnd).toBe('2026-04');
    expect(prisma.account.aggregate).not.toHaveBeenCalled();
  });

  it('returns insufficientData for a single populated month', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany([
          makeTx('2026-04-15T12:00:00Z', 'EXPENSE', 500000),
        ]),
      },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.insufficientData).toBe(true);
    expect(res.months).toEqual([]);
  });

  it('handles a zero-income history', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          MONTHS.map((p) => makeTx(`${p}-15T12:00:00Z`, 'EXPENSE', 1000000)),
        ),
      },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.insufficientData).toBe(false);
    expect(res.months[0].projectedIncomeCents).toBe('0');
    expect(res.months[0].projectedExpenseCents).toBe('1000000');
    expect(res.months[0].projectedNetCashflowCents).toBe('-1000000');
  });

  it('handles a zero-expense history', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          MONTHS.map((p) => makeTx(`${p}-15T12:00:00Z`, 'INCOME', 1000000)),
        ),
      },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.insufficientData).toBe(false);
    expect(res.months[0].projectedExpenseCents).toBe('0');
    expect(res.months[0].projectedIncomeCents).toBe('1000000');
    expect(res.months[0].projectedEndingBalanceCents).toBe('1100000');
  });

  it('projects a negative cashflow', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(1000000, 3000000)) },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.months[0].projectedNetCashflowCents).toBe('-2000000');
    expect(res.months[0].projectedEndingBalanceCents).toBe('-1900000');
  });

  it('excludes transfer transactions', async () => {
    const txs = seedStable(2000000, 1000000);
    txs.push(
      makeTx('2026-04-15T12:00:00Z', 'EXPENSE', 999999999, 'transfer-group-1'),
      makeTx('2026-04-15T12:00:00Z', 'INCOME', 999999999, 'transfer-group-1'),
    );
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany(txs) },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.user_id).toBe('u1');
    expect(txQuery.where.transfer_group_id).toBeNull();
    expect(res.basis.totalIncomeCents).toBe('12000000');
    expect(res.basis.totalExpenseCents).toBe('6000000');
    expect(res.basis.averageMonthlyIncomeCents).toBe('2000000');
  });

  it('flags and excludes a 3-sigma outlier month', async () => {
    const txs = MONTHS.flatMap((period) => {
      const expense = period === '2026-02' ? 200000000 : 1000000;
      return [
        makeTx(`${period}-15T12:00:00Z`, 'INCOME', 2000000),
        makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', expense),
      ];
    });
    const { service } = makeService({
      transaction: { findMany: makeFindMany(txs) },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.outliers).toHaveLength(1);
    expect(res.outliers[0].period).toBe('2026-02');
    expect(res.outliers[0].amountCents).toBe('-198000000');
    expect(res.basis.monthsUsed).toBe(5);
    expect(res.months[0].projectedExpenseCents).toBe('1000000');
    expect(res.confidence).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeLessThanOrEqual(1);
  });

  it('does not dilute the average with missing months', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          MONTHS.slice(4).flatMap((period) => [
            makeTx(`${period}-15T12:00:00Z`, 'INCOME', 2000000),
            makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', 1000000),
          ]),
        ),
      },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.insufficientData).toBe(false);
    expect(res.basis.monthsUsed).toBe(2);
    expect(res.basis.averageMonthlyIncomeCents).toBe('2000000');
    expect(res.basis.averageMonthlyExpenseCents).toBe('1000000');
    expect(res.basis.totalIncomeCents).toBe('4000000');
    expect(res.confidence).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeLessThanOrEqual(1);
  });

  it('exposes the resolved target currency on the response', async () => {
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ currency: 'USD', is_default: true }]),
        aggregate: makeBalanceAgg(100000n),
      },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    expect(res.currency).toBe('USD');
    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.account).toEqual({ currency: 'USD' });
  });

  it('rejects an unsupported target currency instead of forecasting', async () => {
    const { service } = makeService({
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ currency: 'JPY', is_default: true }]),
        aggregate: makeBalanceAgg(100000n),
      },
    });

    await expect(service.forecast('u1', { horizon: 2 })).rejects.toThrow(
      /does not support currency/,
    );
  });

  it('keeps 1,000,000 IDR as 1,000,000 (never scales by 100)', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(1000000, 1000000)) },
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ currency: 'IDR', is_default: true }]),
        aggregate: makeBalanceAgg(0n),
      },
    });

    const res = await service.forecast('u1', { horizon: 1 });

    expect(res.currency).toBe('IDR');
    expect(res.basis.totalIncomeCents).toBe('6000000');
    expect(res.basis.totalExpenseCents).toBe('6000000');
    expect(res.months[0].projectedIncomeCents).toBe('1000000');
    expect(res.months[0].projectedExpenseCents).toBe('1000000');
    expect(res.months[0].projectedNetCashflowCents).toBe('0');
    expect(res.months[0].projectedEndingBalanceCents).toBe('0');
  });

  it('isolates SGD and EUR history by currency without mixing', async () => {
    for (const currency of ['SGD', 'EUR']) {
      const { service, prisma } = makeService({
        transaction: {
          findMany: makeFindMany(seedStable(123, 107)),
        },
        account: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ currency, is_default: true }]),
          aggregate: makeBalanceAgg(100000n),
        },
      });

      const res = await service.forecast('u1', { horizon: 1 });

      const [txQuery] = prisma.transaction.findMany.mock.calls[0];
      expect(txQuery.where.account).toEqual({ currency });
      expect(res.currency).toBe(currency);
      expect(res.months[0].projectedIncomeCents).toBe('123');
      expect(res.months[0].projectedExpenseCents).toBe('107');
      expect(res.months[0].projectedEndingBalanceCents).toBe('100016');
    }
  });

  it('projects a zero net cashflow when income equals expense', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 2000000)) },
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ currency: 'IDR', is_default: true }]),
        aggregate: makeBalanceAgg(500000n),
      },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    expect(res.months[0].projectedNetCashflowCents).toBe('0');
    expect(res.months[0].projectedEndingBalanceCents).toBe('500000');
    expect(res.months[1].projectedEndingBalanceCents).toBe('500000');
  });

  it('clamps the horizon into the supported service range', async () => {
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
    });

    const below = await service.forecast('u1', { horizon: 0 });
    const above = await service.forecast('u1', { horizon: 99 });

    expect(below.horizon).toBe(1);
    expect(above.horizon).toBe(6);
    expect(prisma.transaction.findMany).toHaveBeenCalledTimes(2);
  });

  it('scopes every query to the requesting user', async () => {
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
    });

    await service.forecast('other-user-id', { horizon: 2 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.user_id).toBe('other-user-id');
    const [balQuery] = prisma.account.aggregate.mock.calls[0];
    expect(balQuery.where.user_id).toBe('other-user-id');
  });

  it('buckets transactions by the user timezone month boundaries', async () => {
    const { service, prisma } = makeService({
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
      transaction: {
        findMany: makeFindMany([
          makeTx('2026-03-31T16:59:59Z', 'EXPENSE', 1000),
          makeTx('2026-03-31T17:00:00Z', 'INCOME', 2000),
          makeTx('2026-04-01T00:00:00Z', 'EXPENSE', 3000),
        ]),
      },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.user_id).toBe('u1');
    expect(txQuery.where.transfer_group_id).toBeNull();
    expect(txQuery.where.transaction_date.gte.toISOString()).toBe(
      '2025-10-31T17:00:00.000Z',
    );
    expect(txQuery.where.transaction_date.lt.toISOString()).toBe(
      '2026-04-30T17:00:00.000Z',
    );

    expect(res.insufficientData).toBe(false);
    expect(res.basis.monthsUsed).toBe(2);
    expect(res.basis.totalIncomeCents).toBe('2000');
    expect(res.basis.totalExpenseCents).toBe('4000');
    expect(res.months[0].projectedIncomeCents).toBe('1333');
  });

  it('handles DST transitions when computing month boundaries', async () => {
    const { service, prisma } = makeService({
      userSettings: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ timezone: 'America/New_York' }),
      },
      transaction: {
        findMany: makeFindMany([
          makeTx('2026-03-31T23:59:59Z', 'EXPENSE', 1000),
          makeTx('2026-04-01T03:59:59Z', 'INCOME', 2000),
          makeTx('2026-04-01T04:00:00Z', 'EXPENSE', 3000),
        ]),
      },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.transaction_date.gte.toISOString()).toBe(
      '2025-11-01T04:00:00.000Z',
    );
    expect(txQuery.where.transaction_date.lt.toISOString()).toBe(
      '2026-05-01T04:00:00.000Z',
    );

    expect(res.insufficientData).toBe(false);
    expect(res.basis.totalIncomeCents).toBe('2000');
    expect(res.basis.totalExpenseCents).toBe('4000');
  });

  it('accumulates the projected ending balance across the horizon', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ currency: 'IDR', is_default: true }]),
        aggregate: makeBalanceAgg(5000000n),
      },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    expect(res.months[0].projectedEndingBalanceCents).toBe('6000000');
    expect(res.months[1].projectedEndingBalanceCents).toBe('7000000');
  });

  it('keeps confidence within 0..1 for volatile data', async () => {
    const expenses = [100000, 5000000, 200000, 8000000, 150000, 300000];
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          MONTHS.map((period, i) => [
            makeTx(`${period}-15T12:00:00Z`, 'INCOME', 2000000),
            makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', expenses[i]),
          ]).flat(),
        ),
      },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.insufficientData).toBe(false);
    expect(res.confidence).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeLessThanOrEqual(1);
  });

  it('supports a 1-month horizon', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
    });

    const res = await service.forecast('u1', { horizon: 1 });

    expect(res.months).toHaveLength(1);
    expect(res.months[0].period).toBe('2026-06');
  });

  it('supports a 6-month horizon', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
    });

    const res = await service.forecast('u1', { horizon: 6 });

    expect(res.months).toHaveLength(6);
    expect(res.months.map((m) => m.period)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
  });

  it('excludes deleted transactions through the query scope', async () => {
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
    });

    await service.forecast('u1', { horizon: 2 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.deleted_at).toBeNull();
  });

  it('does not include the current incomplete month in history', async () => {
    const txs = seedStable(2000000, 1000000);
    txs.push(makeTx('2026-05-15T12:00:00Z', 'INCOME', 500000000));
    const { service } = makeService({
      transaction: { findMany: makeFindMany(txs) },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    expect(res.basis.historyEnd).toBe('2026-04');
    expect(res.basis.totalIncomeCents).toBe('12000000');
    expect(res.months[0].period).toBe('2026-06');
  });

  it('preserves exact precision for large money values', async () => {
    const big = 9007199254740993n;
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          MONTHS.flatMap((period) => [
            makeTx(`${period}-15T12:00:00Z`, 'INCOME', big),
            makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', 1000000),
          ]),
        ),
      },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    expect(res.basis.totalIncomeCents).toBe((big * 6n).toString());
    expect(res.months[0].projectedIncomeCents).toBe(big.toString());
    expect(res.basis.totalExpenseCents).toBe('6000000');
    expect(res.months[0].projectedEndingBalanceCents).toBe(
      (100000n + big - 1000000n).toString(),
    );
  });

  it('is deterministic for identical input', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
    });

    const a = await service.forecast('u1', { horizon: 3 });
    const b = await service.forecast('u1', { horizon: 3 });

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('loads transaction history in a single bounded query', async () => {
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
    });

    await service.forecast('u1', { horizon: 2 });

    expect(prisma.transaction.findMany).toHaveBeenCalledTimes(1);
    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.user_id).toBe('u1');
    expect(txQuery.where.deleted_at).toBeNull();
    expect(txQuery.where.transfer_group_id).toBeNull();
    expect(txQuery.where.transaction_date.gte).toBeInstanceOf(Date);
    expect(txQuery.where.transaction_date.lt).toBeInstanceOf(Date);
  });

  it('returns only the documented contract fields with string money values', async () => {
    const txs = MONTHS.flatMap((period) => [
      makeTx(`${period}-15T12:00:00Z`, 'INCOME', 2000000),
      makeTx(
        `${period}-15T12:00:00Z`,
        'EXPENSE',
        period === '2026-01' ? 200000000 : 1000000,
      ),
    ]);
    const { service } = makeService({
      transaction: { findMany: makeFindMany(txs) },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    expect(Object.keys(res).sort()).toEqual([
      'basis',
      'confidence',
      'currency',
      'excludedTransfers',
      'horizon',
      'insufficientData',
      'months',
      'outliers',
    ]);
    expect(Object.keys(res.months[0]).sort()).toEqual([
      'period',
      'projectedEndingBalanceCents',
      'projectedExpenseCents',
      'projectedIncomeCents',
      'projectedNetCashflowCents',
    ]);
    expect(Object.keys(res.basis).sort()).toEqual([
      'averageMonthlyExpenseCents',
      'averageMonthlyIncomeCents',
      'historyEnd',
      'historyStart',
      'monthsUsed',
      'totalExpenseCents',
      'totalIncomeCents',
    ]);
    expect(Object.keys(res.outliers[0]).sort()).toEqual([
      'amountCents',
      'period',
    ]);
    expect(res.months[0].projectedIncomeCents).toMatch(/^\d+$/);
    expect(res.months[0].projectedExpenseCents).toMatch(/^\d+$/);
    expect(res.months[0].projectedNetCashflowCents).toMatch(/^-?\d+$/);
    expect(res.months[0].projectedEndingBalanceCents).toMatch(/^-?\d+$/);
    expect(res.confidence).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeLessThanOrEqual(1);
    expect(Object.keys(res)).not.toContain('transactions');
    expect(Object.keys(res)).not.toContain('accounts');
    expect(Object.keys(res)).not.toContain('transfer_group_id');
  });
});
