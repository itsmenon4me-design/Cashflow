import { IsISO8601, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TrendType } from '../../reports/services/cashflow-trend.service';

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
    enum: ['IDR', 'USD', 'SGD', 'EUR'],
    description: 'Currency code to scope analytics',
  })
  @IsOptional()
  @IsIn(['IDR', 'USD', 'SGD', 'EUR'])
  currency?: string;
}
