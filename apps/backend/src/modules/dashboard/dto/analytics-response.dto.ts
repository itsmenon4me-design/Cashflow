import { ApiProperty } from '@nestjs/swagger';

class ComparisonDto {
  @ApiProperty()
  income: number;
  @ApiProperty()
  expense: number;
  @ApiProperty()
  netCashFlow: number;
}

export class AnalyticsResponseDto {
  @ApiProperty()
  income: number;

  @ApiProperty()
  expense: number;

  @ApiProperty()
  netCashFlow: number;

  @ApiProperty({ type: ComparisonDto })
  comparison: ComparisonDto;
}
