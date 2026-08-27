import {
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FinancialInsightsQueryDto {
  @ApiPropertyOptional({ description: 'Month (1-12)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Year (>=2000)' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  year?: number;
}
