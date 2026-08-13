import { z } from "zod";
import type { CreateCategoryPayload, UpdateCategoryPayload } from "@/services/category.service";

const requiredMessage = "Wajib diisi";

export const categoryFormSchema = z.object({
  name: z.string().min(1, requiredMessage),
  type: z.enum(["INCOME", "EXPENSE"]),
  icon: z.string().min(1, requiredMessage),
  color: z.string().min(1, requiredMessage),
  description: z.string().optional(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function toCreateCategoryPayload(values: CategoryFormValues): CreateCategoryPayload {
  return {
    name: values.name.trim(),
    type: values.type,
    icon: values.icon,
    color: values.color,
    ...(values.description?.trim()
      ? { description: values.description.trim() }
      : {}),
  };
}

export function toUpdateCategoryPayload(values: CategoryFormValues): UpdateCategoryPayload {
  return toCreateCategoryPayload(values);
}