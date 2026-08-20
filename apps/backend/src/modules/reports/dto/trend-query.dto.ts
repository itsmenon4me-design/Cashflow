import { SUPPORTED_CURRENCIES } from '../../../common/types/money';
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrendQueryDto {
  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'] })
  @IsIn(['daily', 'weekly', 'monthly'])
  type: 'daily' | 'weekly' | 'monthly';

  @ApiProperty({ description: 'Start Date (ISO 8601)' })
  @IsISO8601()
  startDate: string;

  @ApiProperty({ description: 'End Date (ISO 8601)' })
  @IsISO8601()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Financial dataset currency scope for trend aggregation.',
    enum: SUPPORTED_CURRENCIES,
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string;
}
