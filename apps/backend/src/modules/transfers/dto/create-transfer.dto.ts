import {
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransferDto {
  @ApiProperty({ description: 'Source account id' })
  @IsString()
  @IsNotEmpty()
  source_account_id!: string;

  @ApiProperty({ description: 'Destination account id' })
  @IsString()
  @IsNotEmpty()
  destination_account_id!: string;

  @ApiProperty({ description: 'Amount in cents' })
  @IsInt()
  @Min(1)
  amount_cents!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ required: false, description: 'Transaction date ISO' })
  @IsOptional()
  @IsDateString()
  transaction_date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
