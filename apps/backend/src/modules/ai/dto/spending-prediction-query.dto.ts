import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_SPENDING_PREDICTION_HORIZON = 1;
export const MAX_SPENDING_PREDICTION_HORIZON = 6;

export class SpendingPredictionQueryDto {
  @ApiPropertyOptional({
    description: 'Number of months to predict',
    minimum: 1,
    maximum: MAX_SPENDING_PREDICTION_HORIZON,
    default: DEFAULT_SPENDING_PREDICTION_HORIZON,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SPENDING_PREDICTION_HORIZON)
  horizon?: number = DEFAULT_SPENDING_PREDICTION_HORIZON;
}
