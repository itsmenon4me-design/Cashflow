import { ApiProperty } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  account_type!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ description: 'Opening balance in cents' })
  opening_balance_cents!: number | string;

  @ApiProperty({ description: 'Current balance in cents' })
  current_balance_cents!: number | string;

  @ApiProperty({ required: false })
  color?: string | null;

  @ApiProperty({ required: false })
  icon?: string | null;

  @ApiProperty({ required: false })
  description?: string | null;

  @ApiProperty()
  is_active!: boolean;

  @ApiProperty()
  is_default!: boolean;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;
}
