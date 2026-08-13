import type { BudgetFormValues } from "@/features/budgets/schema";
import type { BudgetFiltersState, BudgetSortKey } from "@/features/budgets/types";

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const USAGE_SAFE_PERCENT = 70;

export const USAGE_WARNING_PERCENT = 90;

export type UsageTone = "safe" | "warning" | "danger";

export function usageTone(percentage: number): UsageTone {
  if (percentage >= USAGE_WARNING_PERCENT) return "danger";
  if (percentage >= USAGE_SAFE_PERCENT) return "warning";
  return "safe";
}

export const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Agu" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Okt" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Des" },
] as const;

export function getYearOptions(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, index) => current - 1 + index);
}

export const BUDGET_SORT_OPTIONS: { value: BudgetSortKey; label: string }[] = [
  { value: "category_asc", label: "Kategori (A-Z)" },
  { value: "category_desc", label: "Kategori (Z-A)" },
  { value: "amount_desc", label: "Anggaran (Tertinggi)" },
  { value: "amount_asc", label: "Anggaran (Terendah)" },
  { value: "spent_desc", label: "Terpakai (Terbanyak)" },
  { value: "percentage_desc", label: "Penggunaan (Tertinggi)" },
];

export const EMPTY_FILTERS: BudgetFiltersState = {
  search: "",
  sort: "category_asc",
};

export const EMPTY_FORM_VALUES: BudgetFormValues = {
  categoryId: "",
  amount: 0,
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
};