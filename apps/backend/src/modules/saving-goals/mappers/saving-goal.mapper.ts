import { SavingGoalEntity } from '../entities/saving-goal.entity';
import { SavingGoalResponseDto } from '../dto/saving-goal-response.dto';

export function toSavingGoalResponse(
  g: SavingGoalEntity,
): SavingGoalResponseDto {
  return {
    id: g.id,
    user_id: g.user_id,
    category_id: g.category_id ?? null,
    currency: g.currency ?? null,
    name: g.name,
    description: g.description ?? null,
    target_amount_cents: g.target_amount_cents.toString(),
    current_amount_cents: g.current_amount_cents.toString(),
    start_date: g.start_date,
    target_date: g.target_date,
    status: g.status,
    created_at: g.created_at,
    updated_at: g.updated_at,
  };
}
