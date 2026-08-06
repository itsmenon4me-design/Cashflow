import { ApiProperty } from '@nestjs/swagger';

class BudgetCategoryDto {
  @ApiProperty()
  categoryId!: string;

  @ApiProperty({ nullable: true })
  categoryName!: string | null;

  @ApiProperty()
  budgetAmount!: number;

  @ApiProperty()
  spentAmount!: number;

  @ApiProperty()
  remainingAmount!: number;

  @ApiProperty()
  percentageUsed!: number;

  @ApiProperty()
  status!: string;
}

class BudgetOverallDto {
  @ApiProperty()
  budget!: number;

  @ApiProperty()
  spent!: number;

  @ApiProperty()
  remaining!: number;

  @ApiProperty()
  percentageUsed!: number;
}

export class BudgetAnalysisResponseDto {
  @ApiProperty()
  month!: number;

  @ApiProperty()
  year!: number;

  @ApiProperty({ type: BudgetOverallDto })
  overall!: BudgetOverallDto;

  @ApiProperty({ type: () => [BudgetCategoryDto] })
  categories!: BudgetCategoryDto[];
}
