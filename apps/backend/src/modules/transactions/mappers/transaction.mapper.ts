import { TransactionEntity } from '../entities/transaction.entity';
import { TransactionResponseDto } from '../dto/transaction-response.dto';

export function toTransactionResponse(
  t: TransactionEntity,
): TransactionResponseDto {
  return {
    id: t.id,
    category_id: t.category_id,
    transaction_type: t.transaction_type,
    amount_cents: t.amount_cents.toString(),
    transaction_date: t.transaction_date,
    note: t.note ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}
