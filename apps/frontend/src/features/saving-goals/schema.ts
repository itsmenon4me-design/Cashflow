import { z } from "zod";
import { toMinorUnits } from "@/lib/money";
import type {
  CreateSavingGoalPayload,
  UpdateSavingGoalPayload,
} from "@/services/saving-goal.service";

const requiredMessage = "Wajib diisi";

export const savingGoalFormSchema = z.object({
  name: z.string().min(1, requiredMessage),
  description: z.string().optional(),
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
): CreateSavingGoalPayload {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    category_id: values.categoryId || undefined,
    target_amount_cents: toMinorUnits(values.target, "IDR"),
    current_amount_cents: toMinorUnits(values.current, "IDR"),
    start_date: values.startDate,
    target_date: values.targetDate,
    status: values.status,
  };
}

export function toUpdateSavingGoalPayload(
  values: SavingGoalFormValues,
): UpdateSavingGoalPayload {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    category_id: values.categoryId || null,
    target_amount_cents: toMinorUnits(values.target, "IDR"),
    current_amount_cents: toMinorUnits(values.current, "IDR"),
    start_date: values.startDate,
    target_date: values.targetDate,
    status: values.status,
  };
}
