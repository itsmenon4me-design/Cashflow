import { DashboardService } from './dashboard.service';
import { PrismaDashboardRepository } from '../repositories/prisma-dashboard.repository';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import type { PrismaService } from '../../../database/prisma.service';

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

describe('DashboardService', () => {
  let service: DashboardService;
  let repo: jest.Mocked<PrismaDashboardRepository>;
  let getSummaryMock: jest.Mock;
  let prisma: PrismaService;

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    prisma = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
    } as unknown as PrismaService;
    getSummaryMock = jest.fn().mockResolvedValue(
      new DashboardSummaryResponseDto({
        total_assets_cents: '1000',
        total_income_cents: '500',
        total_expense_cents: '200',
        net_cash_flow_cents: '300',
        previous_net_cash_flow_cents: '250',
        total_accounts: 2,
        total_categories: 3,
        total_transactions: 10,
        last_updated_at: new Date(),
      }),
    );
    repo = {
      getSummary: getSummaryMock,
    } as unknown as jest.Mocked<PrismaDashboardRepository>;
    service = new DashboardService(prisma, repo);
  });

  it('returns summary from repository', async () => {
    const res = await service.getSummaryForUser('user-1');
    expect(res).toBeInstanceOf(DashboardSummaryResponseDto);
    expect(getSummaryMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Asia/Jakarta', '2026-08-31T17:00:00.000Z'],
    ['Asia/Makassar', '2026-08-31T16:00:00.000Z'],
    ['Asia/Jayapura', '2026-08-31T15:00:00.000Z'],
  ])('passes the current month start in %s', async (timezone, start) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T18:00:00.000Z'));
    (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({
      timezone,
    });

    await service.getSummaryForUser('user-1');

    expect(getSummaryMock.mock.calls[0][1]).toEqual(new Date(start));
    expect(getSummaryMock.mock.calls[0][3]).toBe(timezone);
  });
});
