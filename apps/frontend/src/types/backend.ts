export interface AuthData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  status: string;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  data?: AuthData;
  user?: UserResponse;
}

export interface RefreshResponse {
  success: boolean;
  message?: string;
  data?: AuthData;
}

export interface DashboardSummaryResponse {
  currency?: string;
  total_assets_cents: string;
  total_income_cents: string;
  total_expense_cents: string;
  net_cash_flow_cents: string;
  total_accounts: number;
  total_categories: number;
  total_transactions: number;
  last_updated_at: string | null;
  by_currency?: Array<{
    currency: string;
    total_assets_cents: string;
    total_income_cents: string;
    total_expense_cents: string;
    net_cash_flow_cents: string;
  }>;
}

export interface TransactionDTO {
  id: string;
  account_id: string;
  category_id: string;
  transaction_type: "INCOME" | "EXPENSE";
  amount_cents: string;
  transaction_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedTransactionResponse {
  success: boolean;
  data: TransactionDTO[];
  pagination: PaginationMeta;
}

export type AccountType =
  | "CASH"
  | "BANK"
  | "E_WALLET"
  | "CREDIT_CARD"
  | "SAVINGS"
  | "INVESTMENT"
  | "OTHER";

export interface AccountResponse {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  opening_balance_cents: string;
  current_balance_cents: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryType = "INCOME" | "EXPENSE";

export interface CategoryResponse {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SuggestCategoryResponse {
  category_id: string;
  category_name: string;
  confidence: number;
  reason?: string | null;
}

export interface ForecastMonth {
  period: string;
  projectedIncomeCents: string;
  projectedExpenseCents: string;
  projectedNetCashflowCents: string;
  projectedEndingBalanceCents: string;
}

export interface ForecastBasis {
  monthsUsed: number;
  historyStart: string;
  historyEnd: string;
  totalIncomeCents: string;
  totalExpenseCents: string;
  averageMonthlyIncomeCents: string;
  averageMonthlyExpenseCents: string;
}

export interface ForecastOutlier {
  period: string;
  amountCents: string;
}

export interface ForecastResponse {
  currency: string;
  horizon: number;
  months: ForecastMonth[];
  confidence: number;
  basis: ForecastBasis;
  excludedTransfers: boolean;
  outliers: ForecastOutlier[];
  insufficientData: boolean;
}

export interface SpendingPredictionCategory {
  categoryId: string;
  categoryName: string;
  predictedAmountCents: string;
  confidence: number;
  basedOnMonths: number;
}

export interface SpendingPredictionResponse {
  currency: string;
  period: string;
  predictedTotalCents: string;
  confidence: number;
  categories: SpendingPredictionCategory[];
  noHistoryCategoryIds: string[];
  otherCents: string;
  insufficientData: boolean;
}
