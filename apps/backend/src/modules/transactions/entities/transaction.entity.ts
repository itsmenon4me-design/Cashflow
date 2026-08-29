export type TransactionType = 'INCOME' | 'EXPENSE';

export class TransactionEntity {
  id!: string;
  user_id!: string;

  category_id!: string;

  transaction_type!: TransactionType;
  amount_cents!: bigint;
  transaction_date!: Date;

  note?: string | null;
  reference_number?: string | null;
  location?: string | null;

  created_at!: Date;
  updated_at!: Date;
  deleted_at?: Date | null;
}
