import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
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

export class UpdateInvestmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  account_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
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
  investment_type?: InvestmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  symbol?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  average_buy_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  current_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  invested_amount_cents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SOLD', 'CLOSED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SOLD', 'CLOSED'])
  status?: InvestmentStatus;
}
