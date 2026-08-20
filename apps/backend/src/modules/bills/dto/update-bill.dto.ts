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
import { BILL_RECURRENCE_TYPES } from './create-bill.dto';
import { SUPPORTED_CURRENCIES } from '../../../common/types/money';

export class UpdateBillDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  payee?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount_cents?: number;

  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string;

  @IsOptional()
  @IsUUID('loose')
  account_id?: string;

  @IsOptional()
  @IsUUID('loose')
  category_id?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  due_date_timezone?: string;

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

  @IsOptional()
  @IsBoolean()
  is_paid?: boolean;
}
