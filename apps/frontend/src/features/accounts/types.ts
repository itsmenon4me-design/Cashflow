import type { AccountType } from "@/types/backend";

export type AccountSortKey =
  | "name_asc"
  | "name_desc"
  | "balance_asc"
  | "balance_desc"
  | "created_desc"
  | "created_asc";

export interface AccountFiltersState {
  search: string;
  type: AccountType | "all";
  sort: AccountSortKey;
}