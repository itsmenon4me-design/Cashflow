export type BudgetSortKey =
  | "category_asc"
  | "category_desc"
  | "amount_desc"
  | "amount_asc"
  | "spent_desc"
  | "percentage_desc";

export interface BudgetFiltersState {
  search: string;
  sort: BudgetSortKey;
}