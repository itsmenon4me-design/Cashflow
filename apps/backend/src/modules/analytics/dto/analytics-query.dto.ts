import { IsISO8601, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TrendType } from '../../reports/services/cashflow-trend.service';
import { SUPPORTED_CURRENCIES } from '../../../common/types/money';

export class AnalyticsQueryDto {
  @ApiProperty({ description: 'Start date (ISO 8601). Required.' })
  @IsISO8601()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO 8601, inclusive).' })
  @IsISO8601()
  endDate: string;

  @ApiPropertyOptional({
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Trend granularity. Resolved from range length when omitted.',
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  granularity?: TrendType;

  @ApiPropertyOptional({
    enum: SUPPORTED_CURRENCIES,
    description: 'Currency code to scope analytics',
  })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string;
}
