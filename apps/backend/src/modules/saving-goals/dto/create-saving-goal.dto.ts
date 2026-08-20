import { SUPPORTED_CURRENCIES } from '../../../common/types/money';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { SavingGoalStatus } from '../entities/saving-goal.entity';

export class CreateSavingGoalDto {
  @ApiProperty({ description: 'Goal name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional account id' })
  @IsOptional()
  @IsString()
  account_id?: string;

  @ApiPropertyOptional({ description: 'Optional category id' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Record currency ownership for the saving goal. Nullable until migration backfill is approved.',
    enum: SUPPORTED_CURRENCIES,
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Target amount in cents' })
  @IsInt()
  @Min(1)
  target_amount_cents!: number;

  @ApiPropertyOptional({
    description: 'Current saved amount in cents',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  current_amount_cents?: number = 0;

  @ApiProperty({ description: 'Start date (ISO)' })
  @IsDateString()
  start_date!: string;

  @ApiProperty({ description: 'Target date (ISO)' })
  @IsDateString()
  target_date!: string;

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'ACTIVE',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'COMPLETED', 'CANCELLED'])
  status?: SavingGoalStatus = 'ACTIVE';
}
