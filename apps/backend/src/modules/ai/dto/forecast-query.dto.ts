import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const DEFAULT_FORECAST_HORIZON = 3;
export const MAX_FORECAST_HORIZON = 6;

export class ForecastQueryDto {
  @ApiPropertyOptional({
    description: 'Number of months to forecast',
    minimum: 1,
    maximum: MAX_FORECAST_HORIZON,
    default: DEFAULT_FORECAST_HORIZON,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_FORECAST_HORIZON)
  horizon?: number = DEFAULT_FORECAST_HORIZON;

  @ApiPropertyOptional({
    description: 'Start of the historical window (ISO 8601 date)',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End of the historical window (ISO 8601 date, inclusive)',
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
