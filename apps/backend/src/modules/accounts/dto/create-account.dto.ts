import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  Min,
  IsInt,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { AccountType } from '../entities/account.entity';
import { SUPPORTED_CURRENCIES } from '../../../common/types/money';

export class CreateAccountDto {
  @ApiProperty({ description: 'Account name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
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
  account_type!: AccountType;

  @ApiProperty({ description: 'Currency (ISO code)', default: 'IDR' })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string = 'IDR';

  @ApiProperty({
    description: 'Opening balance in smallest currency unit (cents)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  opening_balance_cents?: number = 0;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  is_default?: boolean = false;
}
