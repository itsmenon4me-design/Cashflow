import { CashflowTrendService } from './cashflow-trend.service';
import type { PrismaService } from '../../../database/prisma.service';

const makePrismaMock = (
  recs: Array<{
    transaction_date: Date;
    transaction_type: string;
    amount_cents: number | bigint | string;
  }> = [],
): Partial<PrismaService> => {
  return {
    transaction: {
      findMany: jest.fn(() => Promise.resolve(recs)),
    },
  };
};

describe('CashflowTrendService', () => {
  it('daily trend aggregates correctly', async () => {
    const recs = [
      {
        transaction_date: new Date('2026-08-01T10:00:00Z'),
        transaction_type: 'INCOME',
        amount_cents: 100,
      },
      {
        transaction_date: new Date('2026-08-01T12:00:00Z'),
        transaction_type: 'EXPENSE',
        amount_cents: 40,
      },
      {
        transaction_date: new Date('2026-08-02T09:00:00Z'),
        transaction_type: 'INCOME',
        amount_cents: 200,
      },
    ];
    const prisma = makePrismaMock(recs);
    const svc = new CashflowTrendService(prisma as unknown as PrismaService);
    const res = await svc.getTrend(
      'user-1',
      'daily',
      new Date('2026-08-01'),
      new Date('2026-08-03'),
    );
    expect(res.type).toBe('daily');
    expect(res.data.length).toBeGreaterThanOrEqual(2);
    const p1 = res.data.find((d) => d.period === '2026-08-01');
    expect(p1?.income).toBe(100);
    expect(p1?.expense).toBe(40);
  });

  it('weekly trend aggregates correctly', async () => {
    // Dates chosen to fall in same ISO week
    const recs = [
      {
        transaction_date: new Date('2026-08-02T10:00:00Z'),
        transaction_type: 'INCOME',
        amount_cents: 100,
      },
      {
        transaction_date: new Date('2026-08-03T12:00:00Z'),
        transaction_type: 'EXPENSE',
        amount_cents: 50,
      },
      {
        transaction_date: new Date('2026-08-09T09:00:00Z'),
        transaction_type: 'INCOME',
        amount_cents: 200,
      },
    ];
    const prisma = makePrismaMock(recs);
    const svc = new CashflowTrendService(prisma as unknown as PrismaService);
    const res = await svc.getTrend(
      'user-1',
      'weekly',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );
    expect(res.type).toBe('weekly');
    expect(res.data.length).toBeGreaterThanOrEqual(2);
    // period format like '2026-W31' or similar; ensure totals present
    expect(res.data.some((d) => d.income >= 100)).toBe(true);
  });

  it('monthly trend aggregates correctly', async () => {
    const recs = [
      {
        transaction_date: new Date('2026-07-15T10:00:00Z'),
        transaction_type: 'INCOME',
        amount_cents: 500,
      },
      {
        transaction_date: new Date('2026-08-20T12:00:00Z'),
        transaction_type: 'EXPENSE',
        amount_cents: 200,
      },
    ];
    const prisma = makePrismaMock(recs);
    const svc = new CashflowTrendService(prisma as unknown as PrismaService);
    const res = await svc.getTrend(
      'user-1',
      'monthly',
      new Date('2026-07-01'),
      new Date('2026-08-31'),
    );
    expect(res.type).toBe('monthly');
    expect(res.data.some((d) => d.period === '2026-07')).toBe(true);
    expect(res.data.some((d) => d.period === '2026-08')).toBe(true);
  });

  it('returns empty data when no transactions', async () => {
    const prisma = makePrismaMock([]);
    const svc = new CashflowTrendService(prisma as unknown as PrismaService);
    const res = await svc.getTrend(
      'user-1',
      'daily',
      new Date('2026-08-01'),
      new Date('2026-08-02'),
    );
    expect(res.data).toEqual([]);
  });

  it('validates date range', async () => {
    const prisma = makePrismaMock([]);
    const svc = new CashflowTrendService(prisma as unknown as PrismaService);
    await expect(
      svc.getTrend(
        'user-1',
        'daily',
        new Date('2026-08-03'),
        new Date('2026-08-01'),
      ),
    ).rejects.toThrow();
    await expect(
      svc.getTrend(
        'user-1',
        'foo' as unknown as 'daily' | 'weekly' | 'monthly',
        new Date('2026-08-01'),
        new Date('2026-08-02'),
      ),
    ).rejects.toThrow();
  });
});
