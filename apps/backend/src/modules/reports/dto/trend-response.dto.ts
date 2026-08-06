import { ApiProperty } from '@nestjs/swagger';

class TrendItemDto {
  @ApiProperty()
  period: string;
  @ApiProperty()
  income: number;
  @ApiProperty()
  expense: number;
  @ApiProperty()
  netCashFlow: number;
}

export class CashflowTrendResponseDto {
  @ApiProperty()
  type: string;
  @ApiProperty({ type: [TrendItemDto] })
  data: TrendItemDto[];
}
