import { BudgetAnalyticsService } from './budget-analytics.service';
import type { PrismaService } from '../../../database/prisma.service';

describe('BudgetAnalyticsService - regression money invariants', () => {
  it('calculates IDR budget spent/remaining/percentage without double-scaling', async () => {
    // budget row returned by raw query: budget_amount_cents as number (minor units)
    const budgets = [
      { category_id: 'c1', budget_amount_cents: 1000000 }, // 1_000_000 IDR
    ];

    // transactions grouped by category: expense sum in minor units
    const groups = [
      { category_id: 'c1', _sum: { amount_cents: 250000 }, _count: { id: 1 } },
    ];

    const transaction = {
      groupBy: jest.fn().mockResolvedValue(groups),
    };

    const category = {
      findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Food' }]),
    };

    const account = {
      // default account currency IDR
      findMany: jest
        .fn()
        .mockResolvedValue([{ currency: 'IDR', is_default: true }]),
    };

    const prisma: Partial<PrismaService> = {
      $queryRaw: jest.fn().mockResolvedValue(budgets),
      transaction: transaction as unknown as PrismaService['transaction'],
      category: category as unknown as PrismaService['category'],
      account: account as unknown as PrismaService['account'],
    };

    const svc = new BudgetAnalyticsService(prisma as PrismaService);
    const res = await svc.analyzeMonth('u1', 8, 2026);

    expect(res.categories).toHaveLength(1);
    const item = res.categories[0];

    // authoritative minor-unit strings
    expect(item.budgetAmount).toBe('1000000');
    expect(item.spentAmount).toBe('250000');
    // remaining = budget - spent
    expect(item.remainingAmount).toBe('750000');
    // percentage should be 25
    expect(item.percentageUsed).toBe(25);
  });

  it('does not filter transactions by account currency (fixed IDR)', async () => {
    const budgets: any[] = [];

    const transaction = {
      groupBy: jest.fn(() => Promise.resolve([])),
    };

    const category = { findMany: jest.fn().mockResolvedValue([]) };

    const prisma: Partial<PrismaService> = {
      $queryRaw: jest.fn().mockResolvedValue(budgets),
      transaction: transaction as unknown as PrismaService['transaction'],
      category: category as unknown as PrismaService['category'],
    };

    const svc = new BudgetAnalyticsService(prisma as PrismaService);
    await svc.analyzeMonth('u1', 8, 2026);

    expect(transaction.groupBy).toHaveBeenCalled();
    const callArg = (transaction.groupBy.mock.calls as unknown[][])[0]?.[0] as
      { where?: { account?: unknown } } | undefined;
    expect(callArg?.where).toBeDefined();
    // account currency filter must no longer be present
    expect(callArg?.where?.['account']).toBeUndefined();
  });
});
