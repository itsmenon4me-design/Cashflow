export class BillEntity {
  id!: string;
  user_id!: string;

  payee!: string;
  amount_cents!: bigint;
  currency!: string;

  category_id!: string;

  due_date!: Date;
  due_date_timezone!: string;

  is_paid!: boolean;
  paid_at!: Date | null;

  transaction_id!: string | null;

  status!: string;

  recurrence_type!: string;
  recurrence_interval!: number | null;
  recurrence_ends_at!: Date | null;

  series_id!: string | null;
  is_template!: boolean;

  reminder_enabled!: boolean;
  reminder_days_before!: number;
  reminder_time!: string | null;
  reminder_config!: unknown;

  created_at!: Date;
  updated_at!: Date;
  deleted_at!: Date | null;
}
