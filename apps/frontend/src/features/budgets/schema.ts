import { z } from "zod";
import { toMinorUnits } from "@/lib/money";
import type { UpdateBudgetPayload } from "@/services/budget.service";

const requiredMessage = "Wajib diisi";

export const budgetFormSchema = z.object({
  categoryId: z.string().min(1, requiredMessage),
  amount: z
    .number({ error: "Nominal harus berupa angka" })
    .positive(requiredMessage),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1970).max(3000),
});

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export function toCreateBudgetPayload(values: BudgetFormValues) {
  return {
    category_id: values.categoryId,
    budget_amount_cents: toMinorUnits(values.amount, "IDR"),
    month: values.month,
    year: values.year,
  };
}

export function toUpdateBudgetPayload(values: BudgetFormValues): UpdateBudgetPayload {
  return toCreateBudgetPayload(values);
}
