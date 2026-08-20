import type { CategoryResponse } from "@/types/backend";

/**
 * Master category labels.
 *
 * The database stores English internal names (e.g. "Salary", "Food") for
 * consistency, while the UI displays Indonesian labels ("Gaji", "Makanan").
 * Custom user categories that are not in this map fall back to their own name.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  Salary: "Gaji",
  Bonus: "Bonus",
  Gift: "Hadiah",
  Investment: "Investasi",
  "Transfer In": "Transfer Masuk",
  "Other Income": "Pemasukan Lainnya",
  Housing: "Tempat Tinggal",
  Bills: "Tagihan",
  Food: "Makanan",
  Transport: "Transportasi",
  Shopping: "Belanja",
  Entertainment: "Hiburan",
  Travel: "Liburan",
  Health: "Kesehatan",
  Education: "Pendidikan",
  "Transfer Out": "Transfer Keluar",
  "Other Expense": "Pengeluaran Lainnya",
};

export function categoryLabel(name: string | null | undefined): string {
  if (!name) {
    return "-";
  }
  return CATEGORY_LABELS[name] ?? name;
}

export interface CategoryGroup {
  label: string;
  items: string[];
}

/** Split category names by type into dropdown groups (Indonesian labels). */
export function groupCategoriesByType(
  categories: CategoryResponse[],
  incomeLabel: string,
  expenseLabel: string,
): CategoryGroup[] {
  const income: string[] = [];
  const expense: string[] = [];
  for (const category of categories) {
    if (!category.is_active) continue;
    const bucket = category.type === "INCOME" ? income : expense;
    if (!bucket.includes(category.name)) {
      bucket.push(category.name);
    }
  }
  income.sort();
  expense.sort();
  return [
    ...(income.length ? [{ label: incomeLabel, items: income }] : []),
    ...(expense.length ? [{ label: expenseLabel, items: expense }] : []),
  ];
}