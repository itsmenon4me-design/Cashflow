import { MonthlyReportService } from './monthly-report.service';
import type { PrismaService } from '../../../database/prisma.service';
import type { Prisma } from '@prisma/client';

const makePrismaMock = (opts?: {
  inc?: number;
  exp?: number;
  txCount?: number;
  expenseGroups?: Prisma.TransactionGroupByOutputType[];
  incomeGroups?: Prisma.TransactionGroupByOutputType[];
  categories?: Array<{ id: string; name: string }>;
}): Partial<PrismaService> => {
  const {
    inc = 12000000,
    exp = 8700000,
    txCount = 148,
    expenseGroups = [],
    incomeGroups = [],
    categories = [],
  } = opts ?? {};

  const mock: Partial<PrismaService> = {
    transaction: {
      aggregate: jest
        .fn()
        // first call income agg, second expense agg
        .mockImplementationOnce(() =>
          Promise.resolve({ _sum: { amount_cents: inc } }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({ _sum: { amount_cents: exp } }),
        ),
      count: jest.fn(() =>
        Promise.resolve(txCount),
      ) as unknown as PrismaService['transaction']['count'],
      groupBy: jest.fn() as unknown as PrismaService['transaction']['groupBy'],
    } as unknown as PrismaService['transaction'],
    category: {
      findMany: jest.fn(() =>
        Promise.resolve(categories),
      ) as unknown as PrismaService['category']['findMany'],
    } as unknown as PrismaService['category'],
  };

  // chain second groupBy for income groups if needed by tests
  (mock.transaction!.groupBy as jest.Mock)
    .mockImplementationOnce(() => Promise.resolve(expenseGroups))
    .mockImplementationOnce(() => Promise.resolve(incomeGroups));

  return mock;
};

describe('MonthlyReportService', () => {
  it('returns monthly report with top categories', async () => {
    const expenseGroups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c1',
        _sum: { amount_cents: 5000000 },
      } as unknown as Prisma.TransactionGroupByOutputType,
      {
        category_id: 'c2',
        _sum: { amount_cents: 2000000 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const incomeGroups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c3',
        _sum: { amount_cents: 8000000 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const cats = [
      { id: 'c1', name: 'Food' },
      { id: 'c2', name: 'Transport' },
      { id: 'c3', name: 'Salary' },
    ];

    const prisma = makePrismaMock({
      inc: 12000000,
      exp: 8700000,
      txCount: 148,
      expenseGroups,
      incomeGroups,
      categories: cats,
    });
    const svc = new MonthlyReportService(prisma as unknown as PrismaService);
    const res = await svc.getMonthlyReport('user-1', 8, 2026);

    expect(res.month).toBe(8);
    expect(res.year).toBe(2026);
    expect(res.summary.income).toBe(12000000);
    expect(res.summary.expense).toBe(8700000);
    expect(res.summary.netCashFlow).toBe(3300000);
    expect(res.summary.transactions).toBe(148);
    expect(res.topExpenseCategories.length).toBeGreaterThan(0);
    expect(res.topIncomeCategories.length).toBeGreaterThan(0);
    expect(res.topExpenseCategories[0].name).toBe('Food');
  });

  it('handles empty month (no transactions)', async () => {
    const prisma = makePrismaMock({
      inc: 0,
      exp: 0,
      txCount: 0,
      expenseGroups: [],
      incomeGroups: [],
      categories: [],
    });
    const svc = new MonthlyReportService(prisma as unknown as PrismaService);
    const res = await svc.getMonthlyReport('user-1', 2, 2025);
    expect(res.summary.income).toBe(0);
    expect(res.summary.expense).toBe(0);
    expect(res.summary.netCashFlow).toBe(0);
    expect(res.summary.transactions).toBe(0);
    expect(res.topExpenseCategories).toEqual([]);
    expect(res.topIncomeCategories).toEqual([]);
  });

  it('rejects invalid month', async () => {
    const prisma = makePrismaMock();
    const svc = new MonthlyReportService(prisma as unknown as PrismaService);
    await expect(svc.getMonthlyReport('user-1', 13, 2026)).rejects.toThrow();
    await expect(svc.getMonthlyReport('user-1', 0, 2026)).rejects.toThrow();
    await expect(svc.getMonthlyReport('user-1', 5, 10000)).rejects.toThrow();
  });

  it('handles multiple categories sorting and limiting to top 5', async () => {
    const expenseGroups = [
      { category_id: 'c1', _sum: { amount_cents: 900 } },
      { category_id: 'c2', _sum: { amount_cents: 800 } },
      { category_id: 'c3', _sum: { amount_cents: 700 } },
      { category_id: 'c4', _sum: { amount_cents: 600 } },
      { category_id: 'c5', _sum: { amount_cents: 500 } },
      { category_id: 'c6', _sum: { amount_cents: 400 } },
    ];
    const cats = expenseGroups.map((g: unknown, i: number) => ({
      id: (g as Prisma.TransactionGroupByOutputType).category_id,
      name: `Cat${i + 1}`,
    }));
    const prisma = makePrismaMock({
      inc: 0,
      exp: 3500,
      txCount: 6,
      expenseGroups,
      incomeGroups: [],
      categories: cats,
    });
    const svc = new MonthlyReportService(prisma as unknown as PrismaService);
    const res = await svc.getMonthlyReport('user-1', 7, 2026);
    expect(res.topExpenseCategories.length).toBeLessThanOrEqual(5);
    expect(res.topExpenseCategories[0].total).toBeGreaterThanOrEqual(
      res.topExpenseCategories[1].total,
    );
  });
});
