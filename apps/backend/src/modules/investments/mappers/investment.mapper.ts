import { InvestmentEntity } from '../entities/investment.entity';
import { InvestmentResponseDto } from '../dto/investment-response.dto';

export function toInvestmentResponse(
  i: InvestmentEntity,
): InvestmentResponseDto {
  return {
    id: i.id,
    account_id: i.account_id ?? null,
    currency: i.currency ?? null,
    investment_type: i.investment_type,
    platform: i.platform,
    name: i.name,
    symbol: i.symbol ?? null,
    quantity: i.quantity,
    average_buy_price: i.average_buy_price,
    current_price: i.current_price,
    invested_amount_cents: i.invested_amount_cents.toString(),
    current_value_cents: i.current_value_cents.toString(),
    profit_loss_cents: i.profit_loss_cents.toString(),
    profit_loss_percentage: i.profit_loss_percentage,
    purchase_date: i.purchase_date,
    notes: i.notes ?? null,
    status: i.status,
    created_at: i.created_at,
    updated_at: i.updated_at,
  };
}
