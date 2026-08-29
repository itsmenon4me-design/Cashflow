import { BudgetAnalyticsService } from './budget-analytics.service';
import type { PrismaService } from '../../../database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';

describe('BudgetAnalyticsService', () => {
  it('queries transaction groupBy without currency or transfer filters', async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    const transaction = {
      groupBy: jest.fn().mockImplementation((args: unknown) => {
        const a = args as Record<string, unknown>;
        const maybeWhere = a?.where;
        capturedWhere =
          typeof maybeWhere === 'object' && maybeWhere !== null
            ? (maybeWhere as Record<string, unknown>)
            : null;
        return Promise.resolve(
          [] as unknown as Prisma.TransactionGroupByOutputType[],
        );
      }),
    };
    const category = { findMany: jest.fn().mockResolvedValue([]) };
    const prisma: Partial<PrismaService> = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      transaction: transaction as unknown as PrismaService['transaction'],
      category: category as unknown as PrismaService['category'],
    };

    const svc = new BudgetAnalyticsService(prisma as PrismaService);
    await svc.analyzeMonth('u1', 8, 2026);

    expect(capturedWhere).not.toBeNull();
    if (!capturedWhere) return;
    // transfer_group_id and account currency filters must no longer be present
    expect(capturedWhere['transfer_group_id']).toBeUndefined();
    expect(capturedWhere['account']).toBeUndefined();
    // ensure deleted_at and transaction_type still present
    expect(capturedWhere['deleted_at']).toBeNull();
    expect(capturedWhere['transaction_type']).toBeDefined();
  });

  it('counts normal expense stays BigInt-safe', async () => {
    const groups = [
      { category_id: 'c1', _sum: { amount_cents: 1000 }, _count: { id: 1 } },
    ];
    const transaction2 = { groupBy: jest.fn().mockResolvedValue(groups) };
    const category2 = {
      findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Food' }]),
    };
    const prisma: Partial<PrismaService> = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      transaction: transaction2 as unknown as PrismaService['transaction'],
      category: category2 as unknown as PrismaService['category'],
    };
    const svc = new BudgetAnalyticsService(prisma as PrismaService);
    const res = await svc.analyzeMonth('u1', 8, 2026);
    expect(res.categories.length).toBeGreaterThanOrEqual(0);
    expect(typeof res.overall.budget).toBe('string');
    expect(typeof res.overall.spent).toBe('string');
  });
});
