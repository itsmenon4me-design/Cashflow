import { BillEntity } from '../entities/bill.entity';
import { BillResponseDto } from '../dto/bill-response.dto';

export function toBillResponse(bill: BillEntity): BillResponseDto {
  return {
    id: bill.id,
    user_id: bill.user_id,
    payee: bill.payee,
    amount_cents: bill.amount_cents.toString(),
    currency: bill.currency,
    account_id: bill.account_id ?? null,
    category_id: bill.category_id ?? null,
    due_date: bill.due_date,
    due_date_timezone: bill.due_date_timezone ?? null,
    is_paid: bill.is_paid,
    paid_at: bill.paid_at ?? null,
    transaction_id: bill.transaction_id ?? null,
    status: bill.status,
    recurrence_type: bill.recurrence_type,
    recurrence_interval: bill.recurrence_interval ?? null,
    recurrence_ends_at: bill.recurrence_ends_at ?? null,
    series_id: bill.series_id ?? null,
    is_template: bill.is_template,
    reminder_enabled: bill.reminder_enabled,
    reminder_days_before: bill.reminder_days_before ?? null,
    reminder_time: bill.reminder_time ?? null,
    reminder_config: bill.reminder_config ?? null,
    created_at: bill.created_at,
    updated_at: bill.updated_at,
  };
}
