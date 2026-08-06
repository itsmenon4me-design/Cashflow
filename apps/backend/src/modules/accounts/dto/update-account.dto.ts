import { IsOptional, IsString, IsIn, Min, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { AccountType } from '../entities/account.entity';

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    enum: [
      'CASH',
      'BANK',
      'E_WALLET',
      'CREDIT_CARD',
      'SAVINGS',
      'INVESTMENT',
      'OTHER',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'CASH',
    'BANK',
    'E_WALLET',
    'CREDIT_CARD',
    'SAVINGS',
    'INVESTMENT',
    'OTHER',
  ])
  account_type?: AccountType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Opening balance in smallest currency unit (cents)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  opening_balance_cents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  is_default?: boolean;
}
