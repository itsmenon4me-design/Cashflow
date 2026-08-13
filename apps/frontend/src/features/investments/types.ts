import type {
  InvestmentStatus,
  InvestmentType,
} from "@/services/investment.service";

export type InvestmentSortKey =
  | "name_asc"
  | "name_desc"
  | "value_desc"
  | "value_asc"
  | "pl_desc"
  | "purchase_desc";

export interface InvestmentFiltersState {
  search: string;
  type: InvestmentType | "all";
  status: InvestmentStatus | "all";
  sort: InvestmentSortKey;
}