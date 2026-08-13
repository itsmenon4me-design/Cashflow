import { ApiProperty } from '@nestjs/swagger';

class SummaryDto {
  @ApiProperty()
  income: string;

  @ApiProperty()
  expense: string;

  @ApiProperty()
  netCashFlow: string;

  @ApiProperty()
  transactions: number;
}

class CategoryTotalDto {
  @ApiProperty()
  categoryId: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty()
  total: string;
}

export class MonthlyReportResponseDto {
  @ApiProperty()
  month: number;

  @ApiProperty()
  year: number;

  @ApiProperty({ type: SummaryDto })
  summary: SummaryDto;

  @ApiProperty({ type: () => [CategoryTotalDto] })
  topExpenseCategories: CategoryTotalDto[];

  @ApiProperty({ type: () => [CategoryTotalDto] })
  topIncomeCategories: CategoryTotalDto[];
}
