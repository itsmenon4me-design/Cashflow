import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export const BILL_RECURRENCE_TYPES = [
  'NONE',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
] as const;

export class CreateBillDto {
  @IsString()
  @MinLength(1)
  payee!: string;

  @IsInt()
  @Min(1)
  amount_cents!: number;

  @IsString()
  @MinLength(3)
  currency!: string;

  @IsUUID()
  account_id!: string;

  @IsUUID()
  category_id!: string;

  @IsDateString()
  due_date!: string;

  @IsString()
  @MinLength(1)
  due_date_timezone!: string;

  @IsOptional()
  @IsIn(BILL_RECURRENCE_TYPES)
  recurrence_type?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrence_interval?: number;

  @IsOptional()
  @IsDateString()
  recurrence_ends_at?: string;

  @IsOptional()
  @IsBoolean()
  is_template?: boolean;

  @IsOptional()
  @IsBoolean()
  reminder_enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  reminder_days_before?: number;

  @IsOptional()
  @IsString()
  reminder_time?: string;
}
