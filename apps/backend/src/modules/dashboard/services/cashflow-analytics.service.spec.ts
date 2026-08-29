import { CashflowAnalyticsService } from './cashflow-analytics.service';
import type { PrismaService } from '../../../database/prisma.service';

const makePrismaMock = (
  incCurrent = 1000,
  expCurrent = 400,
  incPrev = 800,
  expPrev = 300,
): Partial<PrismaService> => {
  const aggregate = jest
    .fn()
    // order of calls: current INCOME, current EXPENSE, prev INCOME, prev EXPENSE
    .mockImplementationOnce(() =>
      Promise.resolve({ _sum: { amount_cents: incCurrent } }),
    )
    .mockImplementationOnce(() =>
      Promise.resolve({ _sum: { amount_cents: expCurrent } }),
    )
    .mockImplementationOnce(() =>
      Promise.resolve({ _sum: { amount_cents: incPrev } }),
    )
    .mockImplementationOnce(() =>
      Promise.resolve({ _sum: { amount_cents: expPrev } }),
    );

  return {
    transaction: {
      aggregate,
    } as unknown as PrismaService['transaction'],
  };
};

describe('CashflowAnalyticsService', () => {
  it('calculates basic analytics and comparisons', async () => {
    const prisma = makePrismaMock(12500000, 8300000, 11000000, 9000000);
    const svc = new CashflowAnalyticsService(
      prisma as unknown as PrismaService,
    );
    const res = await svc.getAnalytics('user-1');

    expect(res.income).toBe('12500000');
    expect(res.expense).toBe('8300000');
    expect(res.netCashFlow).toBe('4200000');

    expect(typeof res.comparison.income).toBe('number');
    expect(typeof res.comparison.expense).toBe('number');
    expect(typeof res.comparison.netCashFlow).toBe('number');
  });

  it('handles empty transactions (zeros)', async () => {
    const prisma = makePrismaMock(0, 0, 0, 0);
    const svc = new CashflowAnalyticsService(
      prisma as unknown as PrismaService,
    );
    const res = await svc.getAnalytics('user-1');

    expect(res.income).toBe('0');
    expect(res.expense).toBe('0');
    expect(res.netCashFlow).toBe('0');
    expect(res.comparison.income).toBe(0);
    expect(res.comparison.expense).toBe(0);
    expect(res.comparison.netCashFlow).toBe(0);
  });

  it('handles negative net and division by zero safely', async () => {
    // previous income zero => percent change returns 0 by design
    const prisma = makePrismaMock(5000, 7000, 0, 0);
    const svc = new CashflowAnalyticsService(
      prisma as unknown as PrismaService,
    );
    const res = await svc.getAnalytics('user-1');

    expect(res.income).toBe('5000');
    expect(res.expense).toBe('7000');
    expect(res.netCashFlow).toBe('-2000');
    expect(res.comparison.income).toBe(0);
    expect(res.comparison.expense).toBe(0);
  });
});
