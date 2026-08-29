export type SavingGoalStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export class SavingGoalEntity {
  id!: string;
  user_id!: string;
  category_id?: string | null;
  currency?: string | null;
  name!: string;
  description?: string | null;
  target_amount_cents!: bigint;
  current_amount_cents!: bigint;
  start_date!: Date;
  target_date!: Date;
  status!: SavingGoalStatus;
  created_at!: Date;
  updated_at!: Date;
  deleted_at?: Date | null;
}
