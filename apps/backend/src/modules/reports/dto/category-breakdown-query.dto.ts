import { IsInt, Min, Max, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CategoryBreakdownQueryDto {
  @ApiProperty({ description: 'Type', enum: ['income', 'expense'] })
  @IsIn(['income', 'expense'])
  type: 'income' | 'expense';

  @ApiProperty({ description: 'Month (1-12)', minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Year (>=2000)' })
  @IsInt()
  @Min(2000)
  year: number;
}
