import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ enum: ['INCOME', 'EXPENSE'] })
  @IsOptional()
  @IsString()
  @IsIn(['INCOME', 'EXPENSE'])
  transaction_type?: 'INCOME' | 'EXPENSE';

  @ApiPropertyOptional({ description: 'Amount in cents' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!/^[-+]?\d+$/.test(trimmed)) {
        throw new Error('amount_cents must be a whole integer cent value');
      }
      return Number(trimmed);
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error('amount_cents must be a whole integer cent value');
      }
      return value;
    }
    return value;
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount_cents?: number;

  @ApiPropertyOptional({ description: 'Transaction date in ISO format' })
  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
