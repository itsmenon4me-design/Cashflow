export type AccountType =
  | 'CASH'
  | 'BANK'
  | 'E_WALLET'
  | 'CREDIT_CARD'
  | 'SAVINGS'
  | 'INVESTMENT'
  | 'OTHER';

export class AccountEntity {
  id!: string;
  user_id!: string;
  name!: string;
  account_type!: AccountType;
  currency!: string;
  opening_balance_cents!: bigint;
  current_balance_cents!: bigint;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  is_active!: boolean;
  is_default!: boolean;
  created_at!: Date;
  updated_at!: Date;
  deleted_at?: Date | null;
}
