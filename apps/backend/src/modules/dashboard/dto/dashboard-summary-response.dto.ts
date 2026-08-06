export class DashboardSummaryResponseDto {
  total_assets_cents: string; // store as string to preserve bigint
  total_income_cents: string;
  total_expense_cents: string;
  net_cash_flow_cents: string;
  total_accounts: number;
  total_categories: number;
  total_transactions: number;
  last_updated_at: Date | null;

  constructor(init?: Partial<DashboardSummaryResponseDto>) {
    Object.assign(this, init);
  }
}
