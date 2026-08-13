export type InvestmentType =
  | 'Stock'
  | 'Mutual Fund'
  | 'Gold'
  | 'Crypto'
  | 'Bond'
  | 'Deposit'
  | 'Property'
  | 'Other';

export type InvestmentStatus = 'ACTIVE' | 'SOLD' | 'CLOSED';

export class InvestmentEntity {
  id!: string;
  user_id!: string;
  account_id?: string | null;
  investment_type!: InvestmentType;
  platform!: string;
  name!: string;
  symbol?: string | null;
  quantity!: string;
  average_buy_price!: string;
  current_price!: string;
  invested_amount_cents!: bigint;
  current_value_cents!: bigint;
  profit_loss_cents!: bigint;
  profit_loss_percentage!: string;
  purchase_date!: Date;
  notes?: string | null;
  status!: InvestmentStatus;
  created_at!: Date;
  updated_at!: Date;
  deleted_at?: Date | null;
}
