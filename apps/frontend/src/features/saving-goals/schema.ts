import { z } from "zod";
import { toMinorUnits } from "@/lib/money";
import { normalizeDashboardCurrency } from "@/lib/dashboard-currency";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import type {
  CreateSavingGoalPayload,
  UpdateSavingGoalPayload,
} from "@/services/saving-goal.service";

const requiredMessage = "Wajib diisi";

export const savingGoalFormSchema = z.object({
  name: z.string().min(1, requiredMessage),
  description: z.string().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  target: z
    .number({ error: "Nominal harus berupa angka" })
    .positive(requiredMessage),
  current: z
    .number({ error: "Nominal harus berupa angka" })
    .min(0, "Tidak boleh negatif"),
  startDate: z.string().min(1, requiredMessage),
  targetDate: z.string().min(1, requiredMessage),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]),
});

export type SavingGoalFormValues = z.infer<typeof savingGoalFormSchema>;

export function toCreateSavingGoalPayload(
  values: SavingGoalFormValues,
  currency = normalizeDashboardCurrency(
    useDashboardCurrencyStore.getState().currency,
  ) ?? 'USD',
): CreateSavingGoalPayload {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    account_id: values.accountId || undefined,
    category_id: values.categoryId || undefined,
    currency,
    target_amount_cents: toMinorUnits(values.target, currency),
    current_amount_cents: toMinorUnits(values.current, currency),
    start_date: values.startDate,
    target_date: values.targetDate,
    status: values.status,
  };
}

export function toUpdateSavingGoalPayload(
  values: SavingGoalFormValues,
  currency = normalizeDashboardCurrency(
    useDashboardCurrencyStore.getState().currency,
  ) ?? 'USD',
): UpdateSavingGoalPayload {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    account_id: values.accountId || null,
    category_id: values.categoryId || null,
    currency,
    target_amount_cents: toMinorUnits(values.target, currency),
    current_amount_cents: toMinorUnits(values.current, currency),
    start_date: values.startDate,
    target_date: values.targetDate,
    status: values.status,
  };
}