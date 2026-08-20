import { SUPPORTED_CURRENCIES } from '../../../common/types/money';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({ description: 'Expense category id' })
  @IsString()
  @IsNotEmpty()
  category_id!: string;

  @ApiPropertyOptional({
    description: 'Record currency ownership for the budget. Nullable until migration backfill is approved.',
    enum: SUPPORTED_CURRENCIES,
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string;

  @ApiProperty({
    description: 'Budget limit in smallest currency unit (cents)',
  })
  @IsInt()
  @Min(1)
  budget_amount_cents!: number;

  @ApiProperty({ description: 'Budget month (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ description: 'Budget year' })
  @IsInt()
  @Min(1970)
  @Max(3000)
  year!: number;
}
