import type { TransactionFormValues } from "@/features/transactions/schema";
import type { TransactionFiltersState } from "@/features/transactions/types";
import type { TransactionType } from "@/types/dashboard";
import { toInputDate } from "@/lib/date";

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

export function createDefaultTransactionFilters(
  type: TransactionType | "all" = "all",
): TransactionFiltersState {
  const today = toInputDate(new Date());
  return {
    ...EMPTY_FILTERS,
    type,
    startDate: today,
    endDate: today,
  };
}

export const EMPTY_FORM_VALUES: TransactionFormValues = {
  date: "",
  time: "",
  type: "expense",
  category: "",
  amount: 0,
  description: "",
  notes: "",
};
