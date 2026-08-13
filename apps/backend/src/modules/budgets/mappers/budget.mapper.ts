import { BudgetEntity } from '../entities/budget.entity';
import { BudgetResponseDto } from '../dto/budget-response.dto';

export function toBudgetResponse(b: BudgetEntity): BudgetResponseDto {
  return {
    id: b.id,
    category_id: b.category_id,
    category_name: b.category_name ?? null,
    budget_amount_cents: b.budget_amount_cents.toString(),
    month: b.month,
    year: b.year,
    created_at: b.created_at,
    updated_at: b.updated_at,
  };
}
