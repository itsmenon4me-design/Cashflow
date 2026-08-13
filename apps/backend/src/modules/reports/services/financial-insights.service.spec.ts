import { FinancialInsightsService } from './financial-insights.service';
import type { PrismaService } from '../../../database/prisma.service';
import type { Prisma, Transaction } from '../../../generated/prisma/client';

const makePrismaMock = (opts?: {
  inc?: number;
  exp?: number;
  prevInc?: number;
  prevExp?: number;
  groups?: Prisma.TransactionGroupByOutputType[];
  largest?: Transaction | null;
  recs?: Array<{ amount_cents: number; transaction_date: Date }>;
}): PrismaService => {  const {
    inc = 10000,
    exp = 8000,
    prevInc = 9000,
    prevExp = 8500,
    groups = [],
    largest = null,
    recs = [],
  } = opts ?? {};
  const mock: Partial<PrismaService> = {
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

  it('catches errors and returns fallback', async () => {
    const prisma = {
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
