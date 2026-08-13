import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({ description: 'Expense category id' })
  @IsString()
  @IsNotEmpty()
  category_id!: string;

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
