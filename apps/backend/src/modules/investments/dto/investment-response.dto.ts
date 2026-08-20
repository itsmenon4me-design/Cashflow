import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  InvestmentStatus,
  InvestmentType,
} from '../entities/investment.entity';
import { SUPPORTED_CURRENCIES } from '../../../common/types/money';

export class InvestmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  account_id?: string | null;

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES })
  currency?: string | null;

  @ApiProperty()
  investment_type!: InvestmentType;

  @ApiProperty()
  platform!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  symbol?: string | null;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  average_buy_price!: string;

  @ApiProperty()
  current_price!: string;

  @ApiProperty({ description: 'Invested amount in cents' })
  invested_amount_cents!: string;

  @ApiProperty({ description: 'Current value in cents' })
  current_value_cents!: string;

  @ApiProperty({ description: 'Profit or loss in cents' })
  profit_loss_cents!: string;

  @ApiProperty()
  profit_loss_percentage!: string;

  @ApiProperty()
  purchase_date!: Date;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'SOLD', 'CLOSED'] })
  status!: InvestmentStatus;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;
}
