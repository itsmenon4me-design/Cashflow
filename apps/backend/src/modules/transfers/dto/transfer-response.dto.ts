import { ApiProperty } from '@nestjs/swagger';

export class TransferResponseDto {
  @ApiProperty()
  id!: string; // transfer_group_id

  @ApiProperty()
  source_transaction_id!: string;

  @ApiProperty()
  destination_transaction_id!: string;

  @ApiProperty({ description: 'Amount in cents' })
  amount_cents!: string | number;

  @ApiProperty({ required: false })
  reference?: string | null;

  @ApiProperty()
  created_at!: Date;
}
