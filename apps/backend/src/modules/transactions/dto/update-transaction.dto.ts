import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  account_id?: string;

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
