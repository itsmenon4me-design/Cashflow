import { ApiProperty } from '@nestjs/swagger';

class ComparisonDto {
  @ApiProperty({ nullable: true, type: Number })
  income: number | null;
  @ApiProperty({ nullable: true, type: Number })
  expense: number | null;
  @ApiProperty({ nullable: true, type: Number })
  netCashFlow: number | null;
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
