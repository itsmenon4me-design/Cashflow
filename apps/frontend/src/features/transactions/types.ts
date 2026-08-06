import type { TransactionStatus, TransactionType } from "@/types/dashboard";

export interface TransactionFiltersState {
  search: string;
  category: string;
  account: string;
  type: TransactionType | "all";
  status: TransactionStatus | "all";
  startDate: string;
  endDate: string;
}
