import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  account_id!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  category_id!: string;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'] })
  @IsString()
  @IsIn(['INCOME', 'EXPENSE'])
  transaction_type!: 'INCOME' | 'EXPENSE';

  @ApiProperty({ description: 'Amount in cents' })
  @Transform(({ value }: { value: unknown }) => {
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
  amount_cents!: number;

  @ApiProperty({ description: 'Transaction date in ISO format' })
  @IsDateString()
  transaction_date!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    required: false,
    description:
      'Optional client-generated idempotency key (e.g. UUID) used to prevent duplicate transactions on offline sync retries',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference_number?: string;
}
