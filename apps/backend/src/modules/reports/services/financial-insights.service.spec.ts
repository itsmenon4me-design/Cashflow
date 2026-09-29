import { FinancialInsightsService } from './financial-insights.service';
import type { PrismaService } from '../../../database/prisma.service';
import type { Prisma, Transaction } from '../../../generated/prisma/client';

const makePrismaMock = (opts?: {
  timezone?: string;
  inc?: number;
  exp?: number;
  prevInc?: number;
  prevExp?: number;
  groups?: Prisma.TransactionGroupByOutputType[];
  largest?: Transaction | null;
  recs?: Array<{ amount_cents: number; transaction_date: Date }>;
}): PrismaService => {
  const {
    timezone = 'Asia/Jakarta',
    inc = 10000,
    exp = 8000,
    prevInc = 9000,
    prevExp = 8500,
    groups = [],
    largest = null,
    recs = [],
  } = opts ?? {};
  const mock: Partial<PrismaService> = {
    userSettings: {
      findUnique: jest.fn().mockResolvedValue({ timezone }),
    } as unknown as PrismaService['userSettings'],
    transaction: {
      aggregate: jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({ _sum: { amount_cents: inc } }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({ _sum: { amount_cents: exp } }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({ _sum: { amount_cents: prevInc } }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({ _sum: { amount_cents: prevExp } }),
        ),
      groupBy: jest.fn(() =>
        Promise.resolve(groups),
      ) as unknown as PrismaService['transaction']['groupBy'],
      findFirst: jest.fn(() =>
        Promise.resolve(largest),
      ) as unknown as PrismaService['transaction']['findFirst'],
      findMany: jest.fn(() =>
        Promise.resolve(recs),
      ) as unknown as PrismaService['transaction']['findMany'],
    } as unknown as PrismaService['transaction'],
    category: {
      findMany: jest.fn(() =>
        Promise.resolve([
          { id: 'c1', name: 'Food' },
          { id: 'c2', name: 'Travel' },
        ]),
      ) as unknown as PrismaService['category']['findMany'],
    } as unknown as PrismaService['category'],
    account: {
      findMany: jest.fn(() =>
        Promise.resolve([{ currency: 'IDR', is_default: true }]),
      ) as unknown as PrismaService['account']['findMany'],
    } as unknown as PrismaService['account'],
  };
  return mock as unknown as PrismaService;
};

describe('FinancialInsightsService', () => {
  it('generates insights for normal data', async () => {
    const groups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c1',
        _sum: { amount_cents: 5000 },
      } as unknown as Prisma.TransactionGroupByOutputType,
      {
        category_id: 'c2',
        _sum: { amount_cents: 3000 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const largest = { amount_cents: BigInt(2000) } as unknown as Transaction;
    const recs: Array<{ amount_cents: number; transaction_date: Date }> = [
      { amount_cents: 100, transaction_date: new Date('2026-08-01') },
    ];
    const prisma = makePrismaMock({
      inc: 10000,
      exp: 8000,
      prevInc: 9000,
      prevExp: 8500,
      groups,
      largest,
      recs,
    });
    const svc = new FinancialInsightsService(prisma);
    const res = await svc.getInsights('user-1', 8, 2026);
    expect(Array.isArray(res.summary)).toBe(true);
    expect(res.statistics.averageDailyExpense).toBeGreaterThanOrEqual(0);
  });

  it('handles no transactions gracefully', async () => {
    const prisma = makePrismaMock({
      inc: 0,
      exp: 0,
      prevInc: 0,
      prevExp: 0,
      groups: [],
      largest: null,
      recs: [],
    });
    const svc = new FinancialInsightsService(prisma);
    const res = await svc.getInsights('user-1', 2, 2025);
    expect(res.summary.length).toBeGreaterThanOrEqual(0);
    expect(res.statistics.averageDailyExpense).toBe(0);
  });

  it('handles single-month data and comparison', async () => {
    const prisma = makePrismaMock({
      inc: 5000,
      exp: 3000,
      prevInc: 0,
      prevExp: 0,
      groups: [],
      largest: null,
      recs: [],
    });
    const svc = new FinancialInsightsService(prisma);
    const res = await svc.getInsights('user-1', 8, 2026);
    expect(res.summary.length).toBeGreaterThanOrEqual(0);
  });

  it('uses Asia/Jakarta month boundaries and buckets expenses under TZ=UTC', async () => {
    const septemberTransaction = new Date('2026-09-01T03:00:00+07:00');
    const augustTransaction = new Date('2026-08-31T23:59:00+07:00');
    const prisma = makePrismaMock({
      inc: 0,
      exp: 400,
      prevInc: 0,
      prevExp: 0,
      recs: [
        { amount_cents: 100, transaction_date: septemberTransaction },
        { amount_cents: 300, transaction_date: augustTransaction },
      ],
    });
    const aggregate = jest.spyOn(prisma.transaction, 'aggregate');
    const findMany = jest.spyOn(prisma.transaction, 'findMany');

    const result = await new FinancialInsightsService(prisma).getInsights(
      'user-1',
      9,
      2026,
    );

    const currentRange = aggregate.mock.calls[0][0].where.transaction_date;
    expect(currentRange.gte).toEqual(new Date('2026-08-31T17:00:00.000Z'));
    expect(currentRange.lte).toEqual(new Date('2026-09-30T16:59:59.999Z'));
    const previousRange = aggregate.mock.calls[2][0].where.transaction_date;
    expect(previousRange.gte).toEqual(new Date('2026-07-31T17:00:00.000Z'));
    expect(previousRange.lte).toEqual(new Date('2026-08-31T16:59:59.999Z'));

    const sixMonthRange = findMany.mock.calls[0][0].where.transaction_date;
    expect(sixMonthRange.gte).toEqual(new Date('2026-03-31T17:00:00.000Z'));
    expect(sixMonthRange.lte).toEqual(new Date('2026-09-30T16:59:59.999Z'));
    expect(result.statistics.averageMonthlyExpense).toBe(200);
  });

  it('uses the user timezone for the six-month expense window and buckets', async () => {
    const prisma = makePrismaMock({
      timezone: 'Asia/Makassar',
      recs: [
        {
          amount_cents: 100,
          transaction_date: new Date('2026-08-31T16:30:00.000Z'),
        },
        {
          amount_cents: 300,
          transaction_date: new Date('2026-09-30T15:30:00.000Z'),
        },
      ],
    });
    const findMany = jest.spyOn(prisma.transaction, 'findMany');

    const result = await new FinancialInsightsService(prisma).getInsights(
      'user-1',
      9,
      2026,
    );

    const sixMonthRange = findMany.mock.calls[0][0].where.transaction_date;
    expect(sixMonthRange.gte).toEqual(new Date('2026-03-31T16:00:00.000Z'));
    expect(sixMonthRange.lte).toEqual(new Date('2026-09-30T15:59:59.999Z'));
    expect(result.statistics.averageMonthlyExpense).toBe(400);
  });

  it('catches errors and returns fallback', async () => {
    const prisma = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
      transaction: {
        aggregate: jest.fn(() => {
          throw new Error('boom');
        }) as unknown as PrismaService['transaction']['aggregate'],
      } as unknown as PrismaService['transaction'],
      category: {
        findMany: jest.fn() as unknown as PrismaService['category']['findMany'],
      } as unknown as PrismaService['category'],
      account: {
        findMany: jest.fn(() =>
          Promise.resolve([{ currency: 'IDR', is_default: true }]),
        ) as unknown as PrismaService['account']['findMany'],
      } as unknown as PrismaService['account'],
    } as unknown as PrismaService;
    const svc = new FinancialInsightsService(prisma);
    const res = await svc.getInsights('user-1', 8, 2026);
    expect(res.summary.length).toBeGreaterThanOrEqual(0);
  });
});
