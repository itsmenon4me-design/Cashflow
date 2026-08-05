import { AccountEntity } from '../entities/account.entity';
import { AccountResponseDto } from '../dto/account-response.dto';

export function toAccountResponse(a: AccountEntity): AccountResponseDto {
  return {
    id: a.id,
    name: a.name,
    account_type: a.account_type,
    currency: a.currency,
    opening_balance_cents: a.opening_balance_cents.toString(),
    current_balance_cents: a.current_balance_cents.toString(),
    color: a.color ?? null,
    icon: a.icon ?? null,
    description: a.description ?? null,
    is_active: a.is_active,
    is_default: a.is_default,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}
