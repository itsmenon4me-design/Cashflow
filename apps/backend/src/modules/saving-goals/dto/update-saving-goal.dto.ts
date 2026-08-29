import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { SavingGoalStatus } from '../entities/saving-goal.entity';

export class UpdateSavingGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  target_amount_cents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  current_amount_cents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  target_date?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'COMPLETED', 'CANCELLED'])
  status?: SavingGoalStatus;
}
