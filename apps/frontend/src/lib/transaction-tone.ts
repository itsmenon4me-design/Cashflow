import type { TransactionType } from "@/types/dashboard";

/**
 * SINGLE SOURCE OF TRUTH for transaction type colors.
 *
 * Every place that visually distinguishes Pemasukan (income) from
 * Pengeluaran (expense) — tables, cards, dashboards, reports — must read its
 * classes from here. Duplicating ternaries like
 * `type === "income" ? "text-emerald-500" : ...` inline is what caused the
 * pages to drift out of sync in the first place.
 */
export interface TransactionTone {
  /** Amount / signed text color: income = green, expense = red. */
  readonly amountClass: string;
  /** Icon chip background+foreground for the type indicator icon. */
  readonly chipClass: string;
  /** Signed prefix rendered before the formatted amount. */
  readonly sign: "+" | "-";
}

const TONES = {
  income: {
    amountClass: "text-emerald-500",
    chipClass: "bg-emerald-500/10 text-emerald-500",
    sign: "+",
  },
  expense: {
    // --danger (#ef4444): the SAME red used across the app's destructive and
    // expense semantics, so /transactions matches /expenses exactly.
    amountClass: "text-danger",
    chipClass: "bg-danger/10 text-danger",
    sign: "-",
  },
} as const satisfies Record<TransactionType, TransactionTone>;

export function transactionTone(type: TransactionType): TransactionTone {
  return type === "income" ? TONES.income : TONES.expense;
}
