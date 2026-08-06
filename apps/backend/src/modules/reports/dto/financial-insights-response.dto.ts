import { ApiProperty } from '@nestjs/swagger';

export class FinancialStatisticsDto {
  @ApiProperty()
  averageDailyExpense: number | null;
  @ApiProperty()
  averageMonthlyExpense: number | null;
  @ApiProperty()
  largestTransaction: number | null;
}

export class FinancialInsightsResponseDto {
  @ApiProperty({ type: [String] })
  summary: string[];
  @ApiProperty({ type: FinancialStatisticsDto })
  statistics: FinancialStatisticsDto;
}
