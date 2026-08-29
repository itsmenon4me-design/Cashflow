import type { TransactionFormValues } from "@/features/transactions/schema";
import type { TransactionFiltersState } from "@/features/transactions/types";

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const EMPTY_FILTERS: TransactionFiltersState = {
  search: "",
  category: "all",
  type: "all",
  status: "all",
  startDate: "",
  endDate: "",
};

export const EMPTY_FORM_VALUES: TransactionFormValues = {
  date: "",
  time: "",
  type: "expense",
  category: "",
  amount: 0,
  description: "",
  notes: "",
};
