import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('returns a zero score for empty financial data', async () => {
    const monthly = {
      getMonthlyReport: jest.fn().mockResolvedValue({
        summary: {
          income: '0',
          expense: '0',
          netCashFlow: '0',
          transactions: '0',
        },
      }),
    };
    const categoryBreakdown = {
      getBreakdown: jest.fn().mockResolvedValue({
        total: '0',
        categories: [],
      }),
    };
    const cashflowTrend = {
      getTrend: jest.fn(),
    };
    const prisma = {
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ currency: 'IDR', is_default: true }]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { current_balance_cents: 0 } }),
      },
    } as any;

    const service = new AnalyticsService(
      prisma,
      monthly as any,
      categoryBreakdown as any,
      cashflowTrend as any,
    );

    const result = await service.financialHealth('user-1', {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    } as any);

    expect(result.score).toBe(0);
    expect(result.label).toBe('risk');
    expect(result.netCashFlow).toBe('0');
    expect(result.spendingConcentration).toBe(0);
    expect(categoryBreakdown.getBreakdown).not.toHaveBeenCalled();
  });

  it('keeps the normal formula for non-empty data', async () => {
    const monthly = {
      getMonthlyReport: jest.fn().mockResolvedValue({
        summary: {
          income: '100000',
          expense: '50000',
          netCashFlow: '50000',
          transactions: '2',
        },
      }),
    };
    const categoryBreakdown = {
      getBreakdown: jest.fn().mockResolvedValue({
        total: '50000',
        categories: [{ categoryId: 'cat-1', categoryName: 'Food', totalAmount: '50000', percentage: 100, transactionCount: 1 }],
      }),
    };
    const cashflowTrend = { getTrend: jest.fn() };
    const prisma = {
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ currency: 'IDR', is_default: true }]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { current_balance_cents: 100000 } }),
      },
    } as any;
    const service = new AnalyticsService(prisma as any, monthly as any, categoryBreakdown as any, cashflowTrend as any);

    const result = await service.financialHealth('user-1', {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    } as any);

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.netCashFlow).toBe('50000');
  });
});
