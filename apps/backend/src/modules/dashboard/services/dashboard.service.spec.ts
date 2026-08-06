import { DashboardService } from './dashboard.service';
import { PrismaDashboardRepository } from '../repositories/prisma-dashboard.repository';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';

describe('DashboardService', () => {
  let service: DashboardService;
  let repo: jest.Mocked<PrismaDashboardRepository>;
  let getSummaryMock: jest.Mock;

  beforeEach(() => {
    getSummaryMock = jest.fn().mockResolvedValue(
      new DashboardSummaryResponseDto({
        total_assets_cents: '1000',
        total_income_cents: '500',
        total_expense_cents: '200',
        net_cash_flow_cents: '300',
        total_accounts: 2,
        total_categories: 3,
        total_transactions: 10,
        last_updated_at: new Date(),
      }),
    );
    repo = {
      getSummary: getSummaryMock,
    } as unknown as jest.Mocked<PrismaDashboardRepository>;
    service = new DashboardService(repo);
  });

  it('returns summary from repository', async () => {
    const res = await service.getSummaryForUser('user-1');
    expect(res).toBeInstanceOf(DashboardSummaryResponseDto);
    expect(getSummaryMock).toHaveBeenCalledTimes(1);
  });
});
