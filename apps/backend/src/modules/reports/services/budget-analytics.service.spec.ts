import { BudgetAnalyticsService } from './budget-analytics.service';
import type { PrismaService } from '../../../database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';

const makePrismaMock = (
  opts: {
    budgets?: unknown[];
    groups?: Prisma.TransactionGroupByOutputType[];
    categories?: unknown[];
  } = {},
): PrismaService => {
  const { budgets = [], groups = [], categories = [] } = opts;

  const mock: Partial<PrismaService> = {
    $queryRaw: jest.fn(() =>
      Promise.resolve(budgets),
    ) as unknown as PrismaService['$queryRaw'],
    transaction: {
      groupBy: jest.fn(() => Promise.resolve(groups)),
    } as unknown as PrismaService['transaction'],
    category: {
      findMany: jest.fn(() => Promise.resolve(categories)),
    } as unknown as PrismaService['category'],
    account: {
      findMany: jest.fn(() =>
        Promise.resolve([{ currency: 'IDR', is_default: true }]),
      ) as unknown as PrismaService['account']['findMany'],
    } as unknown as PrismaService['account'],
  };

  return mock as unknown as PrismaService;
};

describe('BudgetAnalyticsService', () => {
  it('classifies SAFE', async () => {
    const budgets = [{ category_id: 'c1', budget_amount_cents: 1000 }];
    const groups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c1',
        _sum: { amount_cents: 700 },
        _count: { id: 7 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const cats = [{ id: 'c1', name: 'Food' }];
    const prisma = makePrismaMock({ budgets, groups, categories: cats });
    const svc = new BudgetAnalyticsService(prisma);
    const res = await svc.analyzeMonth('user-1', 8, 2026);
    expect(res.categories[0].status).toBe('SAFE');
    expect(res.categories[0].percentageUsed).toBe(70);
  });

  it('classifies WARNING', async () => {
    const budgets = [{ category_id: 'c1', budget_amount_cents: 1000 }];
    const groups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c1',
        _sum: { amount_cents: 900 },
        _count: { id: 9 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const cats = [{ id: 'c1', name: 'Food' }];
    const prisma = makePrismaMock({ budgets, groups, categories: cats });
    const svc = new BudgetAnalyticsService(prisma);
    const res = await svc.analyzeMonth('user-1', 8, 2026);
    expect(res.categories[0].status).toBe('WARNING');
    expect(res.categories[0].percentageUsed).toBe(90);
  });

  it('classifies OVER_BUDGET', async () => {
    const budgets = [{ category_id: 'c1', budget_amount_cents: 1000 }];
    const groups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c1',
        _sum: { amount_cents: 1200 },
        _count: { id: 12 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const cats = [{ id: 'c1', name: 'Food' }];
    const prisma = makePrismaMock({ budgets, groups, categories: cats });
    const svc = new BudgetAnalyticsService(prisma);
    const res = await svc.analyzeMonth('user-1', 8, 2026);
    expect(res.categories[0].status).toBe('OVER_BUDGET');
    expect(res.categories[0].percentageUsed).toBe(120);
  });

  it('handles empty budgets', async () => {
    const prisma = makePrismaMock({
      budgets: [],
      groups: [],
      categories: [],
    });
    const svc = new BudgetAnalyticsService(prisma);
    const res = await svc.analyzeMonth('user-1', 2, 2025);
    expect(res.categories).toEqual([]);
    expect(res.overall.budget).toBe('0');
  });

  it('handles zero budget preventing division by zero', async () => {
    const budgets = [{ category_id: 'c1', budget_amount_cents: 0 }];
    const groups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c1',
        _sum: { amount_cents: 500 },
        _count: { id: 5 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const cats = [{ id: 'c1', name: 'Misc' }];
    const prisma = makePrismaMock({ budgets, groups, categories: cats });
    const svc = new BudgetAnalyticsService(prisma);
    const res = await svc.analyzeMonth('user-1', 8, 2026);
    expect(res.categories[0].percentageUsed).toBe(0);
    expect(res.categories[0].status).toBe('SAFE');
  });

  it('sorts categories by percentageUsed desc', async () => {
    const budgets = [
      { category_id: 'c1', budget_amount_cents: 1000 },
      { category_id: 'c2', budget_amount_cents: 2000 },
    ];
    const groups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c1',
        _sum: { amount_cents: 900 },
        _count: { id: 9 },
      } as unknown as Prisma.TransactionGroupByOutputType,
      {
        category_id: 'c2',
        _sum: { amount_cents: 1000 },
        _count: { id: 10 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const cats = [
      { id: 'c1', name: 'Food' },
      { id: 'c2', name: 'Travel' },
    ];
    const prisma = makePrismaMock({ budgets, groups, categories: cats });
    const svc = new BudgetAnalyticsService(prisma);
    const res = await svc.analyzeMonth('user-1', 8, 2026);
    expect(res.categories[0].percentageUsed).toBeGreaterThanOrEqual(
      res.categories[1].percentageUsed,
    );
  });
});
