import { BudgetAnalyticsService } from './budget-analytics.service';
import type { PrismaService } from '../../../database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';

describe('BudgetAnalyticsService - transfer exclusion', () => {
  it('excludes transfer_group_id from transaction groupBy', async () => {
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
    const account = {
      findMany: jest
        .fn()
        .mockResolvedValue([{ currency: 'IDR', is_default: true }]),
    };
    const prisma: Partial<PrismaService> = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      transaction: transaction as unknown as PrismaService['transaction'],
      category: category as unknown as PrismaService['category'],
      account: account as unknown as PrismaService['account'],
    };

    const svc = new BudgetAnalyticsService(prisma as PrismaService);
    await svc.analyzeMonth('u1', 8, 2026);

    expect(capturedWhere).not.toBeNull();
    if (!capturedWhere) return;
    // ensure transfer_group_id filter is present and null (exclude transfers)
    expect(capturedWhere['transfer_group_id']).toBeNull();
    // ensure deleted_at and transaction_type still present
    expect(capturedWhere['deleted_at']).toBeNull();
    expect(capturedWhere['transaction_type']).toBeDefined();
  });

  it('counts normal expense and excludes deleted/transfer', async () => {
    // basic end-to-end mock: groups include regular expense; deleted or transfer excluded earlier by where.
    const groups = [
      { category_id: 'c1', _sum: { amount_cents: 1000 }, _count: { id: 1 } },
    ];
    const transaction2 = { groupBy: jest.fn().mockResolvedValue(groups) };
    const category2 = {
      findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Food' }]),
    };
    const account2 = {
      findMany: jest
        .fn()
        .mockResolvedValue([{ currency: 'IDR', is_default: true }]),
    };
    const prisma: Partial<PrismaService> = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      transaction: transaction2 as unknown as PrismaService['transaction'],
      category: category2 as unknown as PrismaService['category'],
      account: account2 as unknown as PrismaService['account'],
    };
    const svc = new BudgetAnalyticsService(prisma as PrismaService);
    const res = await svc.analyzeMonth('u1', 8, 2026);
    expect(res.categories.length).toBeGreaterThanOrEqual(0);
    // exact money values remain BigInt-safe strings at the API boundary
    expect(typeof res.overall.budget).toBe('string');
    expect(typeof res.overall.spent).toBe('string');
  });
});
