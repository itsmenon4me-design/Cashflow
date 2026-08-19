import { IsOptional, IsISO8601, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)', type: String })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)', type: String })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Financial dataset currency scope for cashflow analytics.',
    enum: ['IDR', 'USD', 'SGD', 'EUR'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['IDR', 'USD', 'SGD', 'EUR'])
  currency?: string;
}
