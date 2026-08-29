import { ApiProperty } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  category_id!: string;

  @ApiProperty()
  transaction_type!: string;

  @ApiProperty({ description: 'Amount in cents' })
  amount_cents!: string | number;

  @ApiProperty()
  transaction_date!: Date;

  @ApiProperty({ required: false })
  note?: string | null;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;
}
