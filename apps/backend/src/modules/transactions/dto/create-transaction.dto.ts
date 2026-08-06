import {
  IsNotEmpty,
  IsString,
  IsIn,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
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
  @IsInt()
  @Min(1)
  amount_cents!: number;

  @ApiProperty({ description: 'Transaction date in ISO format' })
  @IsDateString()
  transaction_date!: string;

  @ApiProperty({ required: false })
  @IsString()
  note?: string;
}
