import { SUPPORTED_CURRENCIES } from '../../../common/types/money';
import {
  IsInt,
  Min,
  Max,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TransformFnParams } from 'class-transformer';

export class BudgetQueryDto {
  @ApiProperty({ description: 'Month (1-12)', minimum: 1, maximum: 12 })
  @Transform(({ value }: TransformFnParams) => parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Year (>=2000)' })
  @Transform(({ value }: TransformFnParams) => parseInt(String(value), 10))
  @IsInt()
  @Min(2000)
  year: number;

  @ApiPropertyOptional({
    description: 'Financial dataset currency scope for budget analysis.',
    enum: SUPPORTED_CURRENCIES,
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string;
}
