import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BillResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  user_id!: string;

  @ApiProperty()
  payee!: string;

  @ApiProperty({ description: 'Amount in cents' })
  amount_cents!: string;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional()
  account_id?: string | null;

  @ApiPropertyOptional()
  category_id?: string | null;

  @ApiProperty()
  due_date!: Date;

  @ApiPropertyOptional()
  due_date_timezone?: string | null;

  @ApiProperty()
  is_paid!: boolean;

  @ApiPropertyOptional()
  paid_at?: Date | null;

  @ApiPropertyOptional()
  transaction_id?: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty({ enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] })
  recurrence_type!: string;

  @ApiPropertyOptional()
  recurrence_interval?: number | null;

  @ApiPropertyOptional()
  recurrence_ends_at?: Date | null;

  @ApiPropertyOptional()
  series_id?: string | null;

  @ApiProperty()
  is_template!: boolean;

  @ApiProperty()
  reminder_enabled!: boolean;

  @ApiPropertyOptional()
  reminder_days_before?: number | null;

  @ApiPropertyOptional()
  reminder_time?: string | null;

  @ApiPropertyOptional()
  reminder_config?: unknown;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;
}
