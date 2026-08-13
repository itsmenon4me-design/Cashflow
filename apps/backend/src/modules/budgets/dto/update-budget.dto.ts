import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateBudgetDto {
  @ApiPropertyOptional({ description: 'Expense category id' })
  @IsOptional()
  @IsString()
  category_id?: string;

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
