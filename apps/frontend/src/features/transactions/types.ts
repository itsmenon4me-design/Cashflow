import type { TransactionStatus, TransactionType } from "@/types/dashboard";

export interface TransactionFiltersState {
  search: string;
  category: string;
  type: TransactionType | "all";
  status: TransactionStatus | "all";
  startDate: string;
  endDate: string;
}
