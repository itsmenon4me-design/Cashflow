import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from '../controllers/analytics.controller';
import { DateHelper } from '../../../common/utils/date.util';

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

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
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
    } as any;

    const service = new AnalyticsService(
      prisma,
      monthly as any,
      categoryBreakdown as any,
      cashflowTrend as any,
    );

    const result = await service.financialHealth('user-1', {
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2025-01-31T23:59:59.999Z'),
      timeZone: 'Asia/Jakarta',
    });

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
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
    } as any;
    const service = new AnalyticsService(prisma as any, monthly as any, categoryBreakdown as any, cashflowTrend as any);

    const result = await service.financialHealth('user-1', {
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2025-01-31T23:59:59.999Z'),
      timeZone: 'Asia/Jakarta',
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.netCashFlow).toBe('50000');
  });

  it('compares a full local month to the prior calendar month and handles negative and zero previous values', async () => {
    const current = {
      summary: {
        income: '250',
        expense: '100',
        netCashFlow: '150',
        transactions: 2,
      },
    };
    const previous = {
      summary: {
        income: '0',
        expense: '100',
        netCashFlow: '-100',
        transactions: 1,
      },
    };
    const monthly = {
      getMonthlyReport: jest
        .fn()
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(previous),
    };
    const service = new AnalyticsService(
      {
        userSettings: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ timezone: 'Asia/Makassar' }),
        },
      } as any,
      monthly as any,
      {} as any,
      {} as any,
    );

    const result = await service.overview('user-1', {
      startDate: DateHelper.startOfCalendarMonthInTimezone(
        2026,
        9,
        'Asia/Makassar',
      ),
      endDate: DateHelper.endOfCalendarMonthInTimezone(
        2026,
        9,
        'Asia/Makassar',
      ),
      timeZone: 'Asia/Makassar',
    });

    expect(result.comparison).toEqual({
      income: null,
      expense: 0,
      netCashFlow: 250,
      savingRate: null,
    });
    expect(monthly.getMonthlyReport).toHaveBeenNthCalledWith(
      2,
      'user-1',
      undefined,
      undefined,
      {
        start: new Date('2026-07-31T16:00:00.000Z'),
        end: new Date('2026-08-31T15:59:59.999Z'),
      },
    );
  });

  it.each(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'])(
    'passes Analytics page preset instants and custom date-only ranges to services in %s',
    async (timeZone) => {
      const monthly = {
        getMonthlyReport: jest.fn().mockResolvedValue({
          summary: {
            income: '100',
            expense: '50',
            netCashFlow: '50',
            transactions: 1,
          },
        }),
      };
      const prisma = {
        userSettings: {
          findUnique: jest.fn().mockResolvedValue({ timezone: timeZone }),
        },
      };
      const service = new AnalyticsService(
        prisma as any,
        monthly as any,
        {} as any,
        {} as any,
      );
      const controller = new AnalyticsController(prisma as any, service);
      const septemberStart = DateHelper.startOfCalendarMonthInTimezone(
        2026,
        9,
        timeZone,
      );
      const septemberEnd = DateHelper.endOfCalendarMonthInTimezone(
        2026,
        9,
        timeZone,
      );

      await controller.overview('user-1', {
        startDate: septemberStart.toISOString(),
        endDate: septemberEnd.toISOString(),
      });
      expect(monthly.getMonthlyReport).toHaveBeenNthCalledWith(
        1,
        'user-1',
        undefined,
        undefined,
        { start: septemberStart, end: septemberEnd },
      );

      monthly.getMonthlyReport.mockClear();
      await controller.overview('user-1', {
        startDate: '2026-09-10',
        endDate: '2026-09-20',
      });
      expect(monthly.getMonthlyReport).toHaveBeenNthCalledWith(
        1,
        'user-1',
        undefined,
        undefined,
        {
          start: DateHelper.startOfDayInTimezone('2026-09-10', timeZone),
          end: DateHelper.endOfDayInTimezone('2026-09-20', timeZone),
        },
      );
      expect(
        monthly.getMonthlyReport.mock.calls[0][3].end.getTime(),
      ).toBeLessThan(
        DateHelper.startOfCalendarMonthInTimezone(
          2026,
          10,
          timeZone,
        ).getTime(),
      );

      monthly.getMonthlyReport.mockClear();
      const isoStart = new Date('2026-08-31T17:00:00.000Z');
      const isoEnd = new Date('2026-09-30T16:59:59.999Z');
      await controller.overview('user-1', {
        startDate: isoStart.toISOString(),
        endDate: isoEnd.toISOString(),
      });
      expect(monthly.getMonthlyReport).toHaveBeenNthCalledWith(
        1,
        'user-1',
        undefined,
        undefined,
        { start: isoStart, end: isoEnd },
      );
    },
  );
});
