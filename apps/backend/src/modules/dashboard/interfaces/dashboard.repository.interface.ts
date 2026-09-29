import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';

export interface IDashboardRepository {
  getSummary(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
    timeZone: string,
  ): Promise<DashboardSummaryResponseDto>;
}
