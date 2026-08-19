export class BudgetEntity {
  id!: string;
  user_id!: string;
  category_id!: string;
  currency?: string | null;
  budget_amount_cents!: bigint;
  month!: number;
  year!: number;
  created_at!: Date;
  updated_at!: Date;
  deleted_at?: Date | null;
  category_name?: string | null;
}
