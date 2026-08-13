import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SavingGoalStatus } from '../entities/saving-goal.entity';

export class SavingGoalResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  user_id!: string;

  @ApiPropertyOptional()
  account_id?: string | null;

  @ApiPropertyOptional()
  category_id?: string | null;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ description: 'Target amount in cents' })
  target_amount_cents!: string;

  @ApiProperty({ description: 'Current saved amount in cents' })
  current_amount_cents!: string;

  @ApiProperty()
  start_date!: Date;

  @ApiProperty()
  target_date!: Date;

  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'] })
  status!: SavingGoalStatus;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;
}
