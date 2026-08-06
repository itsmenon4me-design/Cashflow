import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto';

export const DashboardMapper = {
  toDto(
    raw: Partial<DashboardSummaryResponseDto>,
  ): DashboardSummaryResponseDto {
    return new DashboardSummaryResponseDto(raw);
  },
};
