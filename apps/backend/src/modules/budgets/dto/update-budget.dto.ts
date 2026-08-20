import { SUPPORTED_CURRENCIES } from '../../../common/types/money';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateBudgetDto {
  @ApiPropertyOptional({ description: 'Expense category id' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Record currency ownership for the budget. Nullable until migration backfill is approved.',
    enum: SUPPORTED_CURRENCIES,
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string;

  @ApiPropertyOptional({ description: 'Budget limit in cents' })
  @IsOptional()
  @IsInt()
  @Min(1)
  budget_amount_cents?: number;

  @ApiPropertyOptional({ description: 'Budget month (1-12)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Budget year' })
  @IsOptional()
  @IsInt()
  @Min(1970)
  @Max(3000)
  year?: number;
}
