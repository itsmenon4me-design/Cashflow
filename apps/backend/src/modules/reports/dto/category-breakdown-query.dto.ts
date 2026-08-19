import {
  IsInt,
  Min,
  Max,
  IsIn,
  IsOptional,
  IsISO8601,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryBreakdownQueryDto {
  @ApiProperty({ description: 'Type', enum: ['income', 'expense'] })
  @IsIn(['income', 'expense'])
  type: 'income' | 'expense';

  @ApiPropertyOptional({ description: 'Month (1-12)', minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Year (>=2000)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601). Precedence over month/year.',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601, inclusive).' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Financial dataset currency scope for report aggregation.',
    enum: ['IDR', 'USD', 'SGD', 'EUR'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['IDR', 'USD', 'SGD', 'EUR'])
  currency?: string;
}
