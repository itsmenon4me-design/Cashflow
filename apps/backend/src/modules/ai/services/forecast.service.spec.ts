import { ForecastService } from './forecast.service';
import type { PrismaService } from '../../../database/prisma.service';

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

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
};

type TxQuery = {
  where: {
    user_id: string;
    deleted_at: null;
    transaction_date: { gte: Date; lt: Date };
  };
};

const makeTx = (
  date: string,
  type: 'INCOME' | 'EXPENSE',
  cents: number | bigint,
): TxRecord => ({
  id: `tx-${date}-${type}-${cents}`,
  user_id: 'u1',
  transaction_type: type,
  amount_cents: BigInt(cents),
  transaction_date: new Date(date),
});

const seedStable = (income: number, expense: number): TxRecord[] =>
  MONTHS.flatMap((period) => [
    makeTx(`${period}-15T12:00:00Z`, 'INCOME', income),
    makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', expense),
  ]);

const makeFindMany = (rows: TxRecord[]) =>
  jest.fn<Promise<TxRecord[]>, [TxQuery]>().mockResolvedValue(rows);

type PrismaMock = {
  userSettings: { findUnique: jest.Mock };
  transaction: {
    findMany: ReturnType<typeof makeFindMany>;
    aggregate: jest.Mock;
  };
};

type PrismaMockOverrides = {
  userSettings?: Partial<PrismaMock['userSettings']>;
  transaction?: Partial<PrismaMock['transaction']>;
};

type AggregateCall = {
  where: {
    user_id: string;
    deleted_at: null;
    transaction_type: 'INCOME' | 'EXPENSE';
    transaction_date: { lt: Date };
  };
};

type BalanceRecord = TxRecord & { deleted_at: Date | null };

const makeBalanceAggregate = (records: BalanceRecord[]) =>
  jest.fn<Promise<{ _sum: { amount_cents: bigint } }>, [AggregateCall]>(
    ({ where }) => {
      const amount = records
        .filter(
          (record) =>
            record.user_id === where.user_id &&
            record.deleted_at === null &&
            record.transaction_type === where.transaction_type &&
            record.transaction_date < where.transaction_date.lt,
        )
        .reduce((sum, record) => sum + record.amount_cents, 0n);
      return Promise.resolve({ _sum: { amount_cents: amount } });
    },
  );

const makeService = (overrides?: PrismaMockOverrides) => {
  const prisma = {
    userSettings: {
      findUnique:
        overrides?.userSettings?.findUnique ??
        jest.fn().mockResolvedValue({ timezone: 'UTC' }),
    },
    transaction: {
      findMany: overrides?.transaction?.findMany ?? makeFindMany([]),
      aggregate:
        overrides?.transaction?.aggregate ??
        jest.fn().mockResolvedValue({ _sum: { amount_cents: 0n } }),
    },
  };
  const service = new ForecastService(prisma as unknown as PrismaService);
  service.clock = () => new Date(FIXED_NOW.getTime());
  return { service, prisma };
};

describe('ForecastService', () => {
  it('forecasts from a normal 6-month history', async () => {
    const { service } = makeService({
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
    expect(res.months[0].projectedEndingBalanceCents).toBe('1000000');
    expect(res.months[1].projectedEndingBalanceCents).toBe('2000000');
    expect(res.outliers).toEqual([]);
    expect(res.confidence).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeLessThanOrEqual(1);
  });

  it('starts projected balances from accumulated actual cashflow', async () => {
    const aggregate = jest
      .fn<Promise<{ _sum: { amount_cents: bigint } }>, [AggregateCall]>()
      .mockResolvedValueOnce({ _sum: { amount_cents: 25_000_000n } })
      .mockResolvedValueOnce({ _sum: { amount_cents: 8_000_000n } });
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(seedStable(2_000_000, 1_000_000)),
        aggregate,
      },
    });

    const result = await service.forecast('u1', { horizon: 2 });

    expect(result.months[0].projectedEndingBalanceCents).toBe('18000000');
    expect(result.months[1].projectedEndingBalanceCents).toBe('19000000');
    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(aggregate.mock.calls[0][0].where).toEqual({
      user_id: 'u1',
      deleted_at: null,
      transaction_type: 'INCOME',
      transaction_date: { lt: new Date('2026-06-01T00:00:00.000Z') },
    });
    expect(aggregate.mock.calls[1][0].where).toEqual({
      user_id: 'u1',
      deleted_at: null,
      transaction_type: 'EXPENSE',
      transaction_date: { lt: new Date('2026-06-01T00:00:00.000Z') },
    });
  });

  it('limits opening balance to active transactions before forecast starts in WIB', async () => {
    const history = [
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ].flatMap((period) => [
      makeTx(`${period}-15T12:00:00Z`, 'INCOME', 1_000),
      makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', 100),
    ]);
    const records: BalanceRecord[] = [
      {
        ...makeTx('2026-08-31T23:59:00+07:00', 'INCOME', 1_000),
        deleted_at: null,
      },
      {
        ...makeTx('2026-08-31T23:00:00+07:00', 'EXPENSE', 100),
        deleted_at: null,
      },
      {
        ...makeTx('2026-09-01T03:00:00+07:00', 'INCOME', 2_000),
        deleted_at: null,
      },
      {
        ...makeTx('2026-09-15T12:00:00+07:00', 'INCOME', 5_000),
        deleted_at: null,
      },
      {
        ...makeTx('2026-08-30T12:00:00+07:00', 'INCOME', 9_000),
        deleted_at: new Date('2026-08-30T13:00:00+07:00'),
      },
    ];
    const aggregate = makeBalanceAggregate(records);
    const { service } = makeService({
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
      transaction: { findMany: makeFindMany(history), aggregate },
    });
    service.clock = () => new Date('2026-08-15T12:00:00+07:00');

    const result = await service.forecast('u1', { horizon: 1 });

    const forecastStart = new Date('2026-08-31T17:00:00.000Z');
    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(aggregate.mock.calls.map(([query]) => query.where)).toEqual([
      {
        user_id: 'u1',
        deleted_at: null,
        transaction_type: 'INCOME',
        transaction_date: { lt: forecastStart },
      },
      {
        user_id: 'u1',
        deleted_at: null,
        transaction_type: 'EXPENSE',
        transaction_date: { lt: forecastStart },
      },
    ]);
    expect(
      BigInt(result.months[0].projectedEndingBalanceCents) -
        BigInt(result.months[0].projectedNetCashflowCents),
    ).toBe(900n);
  });

  it('matches the dashboard all-time balance when no transactions fall at or after forecast start', async () => {
    const history = [
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ].flatMap((period) => [
      makeTx(`${period}-15T12:00:00Z`, 'INCOME', 1_000),
      makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', 100),
    ]);
    const records: BalanceRecord[] = [
      {
        ...makeTx('2026-08-31T23:59:00+07:00', 'INCOME', 700),
        deleted_at: null,
      },
      {
        ...makeTx('2026-08-31T23:30:00+07:00', 'EXPENSE', 200),
        deleted_at: null,
      },
    ];
    const aggregate = makeBalanceAggregate(records);
    const { service } = makeService({
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
      transaction: { findMany: makeFindMany(history), aggregate },
    });

    service.clock = () => new Date('2026-08-15T12:00:00+07:00');

    const result = await service.forecast('u1', { horizon: 1 });
    const forecastOpeningBalance =
      BigInt(result.months[0].projectedEndingBalanceCents) -
      BigInt(result.months[0].projectedNetCashflowCents);
    const dashboardBalance = records
      .filter((record) => record.deleted_at === null)
      .reduce(
        (balance, record) =>
          balance +
          (record.transaction_type === 'INCOME'
            ? record.amount_cents
            : -record.amount_cents),
        0n,
      );

    expect(result.months[0].period).toBe('2026-09');
    expect(forecastOpeningBalance).toBe(dashboardBalance);
  });

  it.each([
    [
      'Asia/Jakarta',
      '2026-08-31T18:00:00.000Z',
      '2026-09-30T17:00:00.000Z',
    ],
    [
      'Asia/Makassar',
      '2026-08-31T16:00:00.000Z',
      '2026-09-30T16:00:00.000Z',
    ],
    [
      'Asia/Jayapura',
      '2026-08-31T15:00:00.000Z',
      '2026-09-30T15:00:00.000Z',
    ],
  ])(
    'aligns forecast start and opening-balance cutoff in %s',
    async (timeZone, now, cutoff) => {
      const history = [
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
      ].flatMap((period) => [
        makeTx(`${period}-15T12:00:00Z`, 'INCOME', 1_000),
        makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', 100),
      ]);
      const aggregate = jest
        .fn<Promise<{ _sum: { amount_cents: bigint } }>, [AggregateCall]>()
        .mockResolvedValue({ _sum: { amount_cents: 0n } });
      const { service } = makeService({
        userSettings: {
          findUnique: jest.fn().mockResolvedValue({ timezone: timeZone }),
        },
        transaction: { findMany: makeFindMany(history), aggregate },
      });
      service.clock = () => new Date(now);

      const result = await service.forecast('u1', { horizon: 1 });

      expect(result.months[0].period).toBe('2026-10');
      expect(
        aggregate.mock.calls[0][0].where.transaction_date.lt.toISOString(),
      ).toBe(cutoff);
      expect(
        aggregate.mock.calls[1][0].where.transaction_date.lt.toISOString(),
      ).toBe(cutoff);
    },
  );

  it.each([
    [
      'Asia/Jakarta',
      '2026-08-31T18:00:00.000Z',
      '2026-09-30T17:00:00.000Z',
    ],
    [
      'Asia/Makassar',
      '2026-08-31T16:00:00.000Z',
      '2026-09-30T16:00:00.000Z',
    ],
    [
      'Asia/Jayapura',
      '2026-08-31T15:00:00.000Z',
      '2026-09-30T15:00:00.000Z',
    ],
  ])(
    'includes only transactions before the exclusive month cutoff in %s',
    async (timeZone, now, cutoffIso) => {
      const history = [
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
      ].flatMap((period) => [
        makeTx(`${period}-15T12:00:00Z`, 'INCOME', 1_000),
        makeTx(`${period}-16T12:00:00Z`, 'EXPENSE', 100),
      ]);
      const cutoff = new Date(cutoffIso);
      const records: BalanceRecord[] = [
        {
          ...makeTx(
            new Date(cutoff.getTime() - 60_000).toISOString(),
            'INCOME',
            10_000,
          ),
          deleted_at: null,
        },
        {
          ...makeTx(
            new Date(cutoff.getTime() - 1_000).toISOString(),
            'EXPENSE',
            1_000,
          ),
          deleted_at: null,
        },
        {
          ...makeTx(cutoff.toISOString(), 'INCOME', 50_000),
          deleted_at: null,
        },
        {
          ...makeTx(
            new Date(cutoff.getTime() + 1_000).toISOString(),
            'EXPENSE',
            20_000,
          ),
          deleted_at: null,
        },
        {
          ...makeTx(
            new Date(cutoff.getTime() + 60_000).toISOString(),
            'INCOME',
            40_000,
          ),
          deleted_at: null,
        },
      ];
      const aggregate = makeBalanceAggregate(records);
      const { service } = makeService({
        userSettings: {
          findUnique: jest.fn().mockResolvedValue({ timezone: timeZone }),
        },
        transaction: { findMany: makeFindMany(history), aggregate },
      });
      service.clock = () => new Date(now);

      const result = await service.forecast('u1', { horizon: 1 });
      const opening =
        BigInt(result.months[0].projectedEndingBalanceCents) -
        BigInt(result.months[0].projectedNetCashflowCents);

      expect(result.months[0].period).toBe('2026-10');
      expect(opening).toBe(9_000n);
      expect(
        aggregate.mock.calls.map(
          ([query]) => query.where.transaction_date.lt.toISOString(),
        ),
      ).toEqual([cutoffIso, cutoffIso]);
    },
  );

  it.each([
    {
      timeZone: 'Asia/Jakarta',
      frozenAt: '2026-08-31T16:00:00.000Z',
      cutoff: '2026-08-31T17:00:00.000Z',
      opening: 3_500_000n,
      net: 600_000n,
      ending: 4_100_000n,
      includesAug31Expense: true,
      aug31ExpenseAfterFreezeBeforeCutoff: true,
      expectedOutlier: false,
    },
    {
      timeZone: 'Asia/Makassar',
      frozenAt: '2026-08-31T15:00:00.000Z',
      cutoff: '2026-08-31T16:00:00.000Z',
      opening: 3_600_000n,
      net: 600_000n,
      ending: 4_200_000n,
      includesAug31Expense: false,
      aug31ExpenseAfterFreezeBeforeCutoff: false,
      expectedOutlier: false,
    },
    {
      timeZone: 'Asia/Jakarta',
      frozenAt: '2026-08-31T18:00:00.000Z',
      cutoff: '2026-09-30T17:00:00.000Z',
      opening: 3_630_000n,
      net: 600_000n,
      ending: 4_230_000n,
      includesAug31Expense: true,
      aug31ExpenseAfterFreezeBeforeCutoff: false,
      expectedOutlier: true,
    },
    {
      timeZone: 'Asia/Jakarta',
      frozenAt: '2026-09-15T05:00:00.000Z',
      cutoff: '2026-09-30T17:00:00.000Z',
      opening: 3_630_000n,
      net: 600_000n,
      ending: 4_230_000n,
      includesAug31Expense: true,
      aug31ExpenseAfterFreezeBeforeCutoff: false,
      expectedOutlier: true,
    },
    {
      timeZone: 'Asia/Makassar',
      frozenAt: '2026-09-15T05:00:00.000Z',
      cutoff: '2026-09-30T16:00:00.000Z',
      opening: 3_630_000n,
      net: 600_000n,
      ending: 4_230_000n,
      includesAug31Expense: true,
      aug31ExpenseAfterFreezeBeforeCutoff: false,
      expectedOutlier: false,
    },
    {
      timeZone: 'Asia/Jayapura',
      frozenAt: '2026-09-15T05:00:00.000Z',
      cutoff: '2026-09-30T15:00:00.000Z',
      opening: 3_630_000n,
      net: 600_000n,
      ending: 4_230_000n,
      includesAug31Expense: true,
      aug31ExpenseAfterFreezeBeforeCutoff: false,
      expectedOutlier: false,
    },
    {
      timeZone: 'UTC',
      frozenAt: '2026-09-15T05:00:00.000Z',
      cutoff: '2026-10-01T00:00:00.000Z',
      opening: 3_630_000n,
      net: 600_000n,
      ending: 4_230_000n,
      includesAug31Expense: true,
      aug31ExpenseAfterFreezeBeforeCutoff: false,
      expectedOutlier: true,
    },
    {
      timeZone: 'Asia/Jayapura',
      frozenAt: '2026-08-31T18:00:00.000Z',
      cutoff: '2026-09-30T15:00:00.000Z',
      opening: 3_630_000n,
      net: 600_000n,
      ending: 4_230_000n,
      includesAug31Expense: true,
      aug31ExpenseAfterFreezeBeforeCutoff: false,
      expectedOutlier: false,
    },
    {
      timeZone: 'Asia/Makassar',
      frozenAt: '2026-08-31T18:00:00.000Z',
      cutoff: '2026-09-30T16:00:00.000Z',
      opening: 3_630_000n,
      net: 600_000n,
      ending: 4_230_000n,
      includesAug31Expense: true,
      aug31ExpenseAfterFreezeBeforeCutoff: false,
      expectedOutlier: false,
    },
    {
      timeZone: 'UTC',
      frozenAt: '2026-08-31T18:00:00.000Z',
      cutoff: '2026-09-01T00:00:00.000Z',
      opening: 3_750_000n,
      net: 600_000n,
      ending: 4_350_000n,
      includesAug31Expense: true,
      aug31ExpenseAfterFreezeBeforeCutoff: false,
      expectedOutlier: false,
    },
  ])(
    'documents opening balance at the projection cutoff for $timeZone frozen at $frozenAt',
    async ({
      timeZone,
      frozenAt,
      cutoff,
      opening,
      net,
      ending,
      includesAug31Expense,
      aug31ExpenseAfterFreezeBeforeCutoff,
      expectedOutlier,
    }) => {
      const recurring = [
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
      ].flatMap((period) => [
        makeTx(`${period}-15T12:00:00.000Z`, 'INCOME', 1_000_000),
        makeTx(`${period}-16T12:00:00.000Z`, 'EXPENSE', 400_000),
      ]);
      const aug31Expense = makeTx(
        '2026-08-31T16:59:00.000Z',
        'EXPENSE',
        100_000,
      );
      const laterTransactions = [
        makeTx('2026-08-31T20:00:00.000Z', 'INCOME', 250_000),
        makeTx('2026-09-06T17:30:00.000Z', 'EXPENSE', 50_000),
        makeTx('2026-09-20T05:00:00.000Z', 'EXPENSE', 70_000),
        makeTx('2026-10-05T05:00:00.000Z', 'INCOME', 90_000),
      ];
      const activeRecords: BalanceRecord[] = [
        ...recurring,
        aug31Expense,
        ...laterTransactions,
      ].map((record) => ({ ...record, deleted_at: null }));
      activeRecords.push({
        ...makeTx('2026-08-31T15:00:00.000Z', 'INCOME', 999_000),
        deleted_at: new Date('2026-09-15T05:00:00.000Z'),
      });

      const aggregate = makeBalanceAggregate(activeRecords);
      const { service } = makeService({
        userSettings: {
          findUnique: jest.fn().mockResolvedValue({ timezone: timeZone }),
        },
        transaction: {
          findMany: makeFindMany([...recurring, aug31Expense, ...laterTransactions]),
          aggregate,
        },
      });
      service.clock = () => new Date(frozenAt);

      const result = await service.forecast('u1', { horizon: 1 });
      const forecastOpening =
        BigInt(result.months[0].projectedEndingBalanceCents) -
        BigInt(result.months[0].projectedNetCashflowCents);
      const openingBeforeCutoff =
        activeRecords
          .filter(
            (record) =>
              record.deleted_at === null &&
              record.transaction_date < new Date(cutoff),
          )
          .reduce(
            (balance, record) =>
              balance +
              (record.transaction_type === 'INCOME'
                ? record.amount_cents
                : -record.amount_cents),
            0n,
          );

      expect(result.months[0].projectedNetCashflowCents).toBe(net.toString());
      expect(forecastOpening).toBe(opening);
      expect(openingBeforeCutoff).toBe(opening);
      expect(result.months[0].projectedEndingBalanceCents).toBe(
        ending.toString(),
      );
      expect(
        aggregate.mock.calls[0][0].where.transaction_date.lt.toISOString(),
      ).toBe(cutoff);
      expect(
        activeRecords.some(
          (record) =>
            record.id === aug31Expense.id &&
            record.deleted_at === null &&
            record.transaction_date < new Date(cutoff),
        ),
      ).toBe(includesAug31Expense);
      expect(
        aug31Expense.transaction_date > new Date(frozenAt) &&
          aug31Expense.transaction_date < new Date(cutoff),
      ).toBe(aug31ExpenseAfterFreezeBeforeCutoff);
      expect(result.outliers.some((item) => item.period === '2026-08')).toBe(
        expectedOutlier,
      );
    },
  );

  it('starts with zero balance when no active transactions qualify for the opening balance', async () => {
    const history = [
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ].flatMap((period) => [
      makeTx(`${period}-15T12:00:00Z`, 'INCOME', 1_000),
      makeTx(`${period}-15T12:00:00Z`, 'EXPENSE', 100),
    ]);
    const aggregate = makeBalanceAggregate([]);
    const { service } = makeService({
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
      transaction: { findMany: makeFindMany(history), aggregate },
    });
    service.clock = () => new Date('2026-08-15T12:00:00+07:00');

    const result = await service.forecast('u1', { horizon: 1 });
    const forecastOpeningBalance =
      BigInt(result.months[0].projectedEndingBalanceCents) -
      BigInt(result.months[0].projectedNetCashflowCents);

    expect(forecastOpeningBalance).toBe(0n);
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
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
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
    expect(res.months[0].projectedEndingBalanceCents).toBe('1000000');
  });

  it('projects a negative cashflow', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(1000000, 3000000)) },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    expect(res.months[0].projectedNetCashflowCents).toBe('-2000000');
    expect(res.months[0].projectedEndingBalanceCents).toBe('-2000000');
  });

  it('includes all transactions', async () => {
    const txs = seedStable(2000000, 1000000);
    txs.push(
      makeTx('2026-04-15T12:00:00Z', 'EXPENSE', 999999999),
      makeTx('2026-04-15T12:00:00Z', 'INCOME', 999999999),
    );
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany(txs) },
    });

    const res = await service.forecast('u1', { horizon: 3 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.user_id).toBe('u1');
    expect(res.basis.totalIncomeCents).toBe('1011999999');
    expect(res.basis.totalExpenseCents).toBe('1005999999');
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

  it('always returns fixed IDR on the response', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 1000000)) },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    expect(res.currency).toBe('IDR');
  });

  it('keeps 1,000,000 IDR as 1,000,000 (never scales by 100)', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(1000000, 1000000)) },
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

  it('projects a zero net cashflow when income equals expense', async () => {
    const { service } = makeService({
      transaction: { findMany: makeFindMany(seedStable(2000000, 2000000)) },
    });

    const res = await service.forecast('u1', { horizon: 2 });

    expect(res.months[0].projectedNetCashflowCents).toBe('0');
    expect(res.months[0].projectedEndingBalanceCents).toBe('0');
    expect(res.months[1].projectedEndingBalanceCents).toBe('0');
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

  it('uses the WIB fallback for month buckets under TZ=UTC', async () => {
    const originalDefaultTimezone = process.env.APP_DEFAULT_TIMEZONE;
    process.env.APP_DEFAULT_TIMEZONE = '';
    try {
      const transactions = [
        makeTx('2026-09-01T03:00:00+07:00', 'INCOME', 100),
        makeTx('2026-08-31T23:59:00+07:00', 'EXPENSE', 40),
      ];
      const { service } = makeService({
        userSettings: {
          findUnique: jest.fn().mockResolvedValue({ timezone: null }),
        },
        transaction: { findMany: makeFindMany(transactions) },
      });
      service.clock = () => new Date('2026-10-15T12:00:00Z');

      const res = await service.forecast('u1', {
        horizon: 1,
        startDate: '2026-08-01T00:00:00+07:00',
        endDate: '2026-09-30T23:59:59+07:00',
      });

      expect(res.insufficientData).toBe(false);
      expect(res.basis.historyStart).toBe('2026-08');
      expect(res.basis.historyEnd).toBe('2026-09');
      expect(res.basis.monthsUsed).toBe(2);
      expect(res.basis.totalIncomeCents).toBe('100');
      expect(res.basis.totalExpenseCents).toBe('40');
    } finally {
      if (originalDefaultTimezone === undefined) {
        delete process.env.APP_DEFAULT_TIMEZONE;
      } else {
        process.env.APP_DEFAULT_TIMEZONE = originalDefaultTimezone;
      }
    }
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
    });

    const res = await service.forecast('u1', { horizon: 2 });

    expect(res.months[0].projectedEndingBalanceCents).toBe('1000000');
    expect(res.months[1].projectedEndingBalanceCents).toBe('2000000');
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
      (big - 1000000n).toString(),
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
  });
});
