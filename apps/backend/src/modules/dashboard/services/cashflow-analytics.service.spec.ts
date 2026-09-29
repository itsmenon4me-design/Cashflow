import { CashflowAnalyticsService } from './cashflow-analytics.service';
import type { PrismaService } from '../../../database/prisma.service';

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

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
    userSettings: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
    },
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

    expect(res.comparison.income).toBe(13.64);
    expect(res.comparison.expense).toBe(-7.78);
    expect(res.comparison.netCashFlow).toBe(110);
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
    expect(res.comparison.income).toBeNull();
    expect(res.comparison.expense).toBeNull();
    expect(res.comparison.netCashFlow).toBeNull();
  });

  it('handles negative net and division by zero safely', async () => {
    // A zero previous period has no defined percentage change.
    const prisma = makePrismaMock(5000, 7000, 0, 0);
    const svc = new CashflowAnalyticsService(
      prisma as unknown as PrismaService,
    );
    const res = await svc.getAnalytics('user-1');

    expect(res.income).toBe('5000');
    expect(res.expense).toBe('7000');
    expect(res.netCashFlow).toBe('-2000');
    expect(res.comparison.income).toBeNull();
    expect(res.comparison.expense).toBeNull();
  });

  it('keeps the comparison direction when the previous net cashflow was negative', async () => {
    const prisma = makePrismaMock(100, 150, 0, 100);
    const svc = new CashflowAnalyticsService(
      prisma as unknown as PrismaService,
    );
    const result = await svc.getAnalytics('user-1');

    expect(result.netCashFlow).toBe('-50');
    expect(result.comparison.netCashFlow).toBe(50);
  });

  it('uses user-zone date-only boundaries and compares full calendar months', async () => {
    const prisma = makePrismaMock();
    prisma.userSettings!.findUnique = jest
      .fn()
      .mockResolvedValue({ timezone: 'Asia/Makassar' });
    const svc = new CashflowAnalyticsService(
      prisma as unknown as PrismaService,
    );

    await svc.getAnalytics('user-1', '2026-09-01', '2026-09-30');

    const aggregate = prisma.transaction!.aggregate as jest.Mock;
    expect(aggregate.mock.calls[0][0].where.transaction_date).toEqual({
      gte: new Date('2026-08-31T16:00:00.000Z'),
      lte: new Date('2026-09-30T15:59:59.999Z'),
    });
    expect(aggregate.mock.calls[2][0].where.transaction_date).toEqual({
      gte: new Date('2026-07-31T16:00:00.000Z'),
      lte: new Date('2026-08-31T15:59:59.999Z'),
    });
  });
});
