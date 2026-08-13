import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  InvestmentStatus,
  InvestmentType,
} from '../entities/investment.entity';

export class CreateInvestmentDto {
  @ApiPropertyOptional({ description: 'Optional linked account id' })
  @IsOptional()
  @IsString()
  account_id?: string;

  @ApiProperty({
    enum: [
      'Stock',
      'Mutual Fund',
      'Gold',
      'Crypto',
      'Bond',
      'Deposit',
      'Property',
      'Other',
    ],
  })
  @IsString()
  @IsIn([
    'Stock',
    'Mutual Fund',
    'Gold',
    'Crypto',
    'Bond',
    'Deposit',
    'Property',
    'Other',
  ])
  investment_type!: InvestmentType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  platform!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  symbol?: string;

  @ApiProperty({ description: 'Quantity held' })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ description: 'Average buy price per unit' })
  @IsNumber()
  @Min(0)
  average_buy_price!: number;

  @ApiProperty({ description: 'Current price per unit' })
  @IsNumber()
  @Min(0)
  current_price!: number;

  @ApiPropertyOptional({
    description: 'Invested amount in cents. Computed if omitted',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  invested_amount_cents?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ description: 'Purchase date (ISO)' })
  @IsDateString()
  purchase_date!: string;

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'SOLD', 'CLOSED'],
    default: 'ACTIVE',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'SOLD', 'CLOSED'])
  status?: InvestmentStatus = 'ACTIVE';
}
