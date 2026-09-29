import { CashflowTrendService } from './cashflow-trend.service';
import type { PrismaService } from '../../../database/prisma.service';

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

const makePrismaMock = (
  recs: Array<{
    transaction_date: Date;
    transaction_type: string;
    amount_cents: number | bigint | string;
  }> = [],
): PrismaService => {
  return {
    userSettings: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
    },
    transaction: {
      findMany: jest.fn(() =>
        Promise.resolve(recs),
      ) as unknown as PrismaService['transaction']['findMany'],
    } as unknown as PrismaService['transaction'],
    account: {
      findMany: jest.fn(() =>
        Promise.resolve([{ currency: 'IDR', is_default: true }]),
      ) as unknown as PrismaService['account']['findMany'],
    } as unknown as PrismaService['account'],
  } as unknown as PrismaService;
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
    const svc = new CashflowTrendService(prisma);
    const res = await svc.getTrend(
      'user-1',
      'daily',
      new Date('2026-08-01'),
      new Date('2026-08-03'),
    );
    expect(res.type).toBe('daily');
    expect(res.data.length).toBeGreaterThanOrEqual(2);
    const p1 = res.data.find((d) => d.period === '2026-08-01');
    expect(p1?.income).toBe('100');
    expect(p1?.expense).toBe('40');
  });

  it.each([
    ['Asia/Jakarta', '+07:00'],
    ['Asia/Makassar', '+08:00'],
    ['Asia/Jayapura', '+09:00'],
  ])(
    'keeps local midnight and Monday buckets in %s',
    async (timeZone, offset) => {
      const recs = [
        {
          transaction_date: new Date(`2026-08-31T23:59:59${offset}`),
          transaction_type: 'INCOME',
          amount_cents: 100,
        },
        {
          transaction_date: new Date(`2026-09-01T00:00:01${offset}`),
          transaction_type: 'INCOME',
          amount_cents: 200,
        },
        {
          transaction_date: new Date(`2026-09-07T00:30:00${offset}`),
          transaction_type: 'EXPENSE',
          amount_cents: 300,
        },
      ];
      const prisma = makePrismaMock(recs);
      prisma.userSettings!.findUnique = jest
        .fn()
        .mockResolvedValue({ timezone: timeZone });
      const service = new CashflowTrendService(prisma);

      const daily = await service.getTrend(
        'user-1',
        'daily',
        new Date('2026-08-31T00:00:00.000Z'),
        new Date('2026-09-08T00:00:00.000Z'),
      );
      expect(daily.data.map((item) => item.period)).toEqual([
        '2026-08-31',
        '2026-09-01',
        '2026-09-07',
      ]);

      const weekly = await service.getTrend(
        'user-1',
        'weekly',
        new Date('2026-08-31T00:00:00.000Z'),
        new Date('2026-09-08T00:00:00.000Z'),
      );
      expect(weekly.data.map((item) => item.period)).toEqual([
        '2026-W36',
        '2026-W37',
      ]);
      expect(weekly.data[1].expense).toBe('300');
    },
  );

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
    const svc = new CashflowTrendService(prisma);
    const res = await svc.getTrend(
      'user-1',
      'weekly',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );
    expect(res.type).toBe('weekly');
    expect(res.data.length).toBeGreaterThanOrEqual(2);
    // period format like '2026-W31' or similar; ensure totals present
    expect(res.data.some((d) => BigInt(d.income) >= 100n)).toBe(true);
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
    const svc = new CashflowTrendService(prisma);
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

  it('buckets offset timestamps by WIB day, ISO week, and month', async () => {
    const recs = [
      {
        transaction_date: new Date('2026-09-01T03:00:00+07:00'),
        transaction_type: 'INCOME',
        amount_cents: 100,
      },
      {
        transaction_date: new Date('2026-08-31T23:59:00+07:00'),
        transaction_type: 'EXPENSE',
        amount_cents: 40,
      },
    ];
    const from = new Date('2026-08-31T00:00:00+07:00');
    const to = new Date('2026-09-01T23:59:59+07:00');

    const daily = await new CashflowTrendService(
      makePrismaMock(recs),
    ).getTrend('user-1', 'daily', from, to);
    expect(daily.data.map((point) => point.period)).toEqual([
      '2026-08-31',
      '2026-09-01',
    ]);

    const weekly = await new CashflowTrendService(
      makePrismaMock(recs),
    ).getTrend('user-1', 'weekly', from, to);
    expect(weekly.data).toEqual([
      {
        period: '2026-W36',
        income: '100',
        expense: '40',
        netCashFlow: '60',
      },
    ]);

    const monthly = await new CashflowTrendService(
      makePrismaMock(recs),
    ).getTrend('user-1', 'monthly', from, to);
    expect(monthly.data.map((point) => point.period)).toEqual([
      '2026-08',
      '2026-09',
    ]);
  });

  it('returns empty data when no transactions', async () => {
    const prisma = makePrismaMock([]);
    const svc = new CashflowTrendService(prisma);
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
    const svc = new CashflowTrendService(prisma);
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
