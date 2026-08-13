import { z } from "zod";
import { toMinorUnits } from "@/lib/money";
import type { UpdateAccountPayload } from "@/services/account.service";

const requiredMessage = "Wajib diisi";

export const accountFormSchema = z.object({
  name: z.string().min(1, requiredMessage),
  accountType: z.enum([
    "CASH",
    "BANK",
    "E_WALLET",
    "CREDIT_CARD",
    "SAVINGS",
    "INVESTMENT",
    "OTHER",
  ]),
  currency: z.string().min(1, requiredMessage).max(3),
  openingBalance: z
    .number({ error: "Nominal harus berupa angka" })
    .min(0, "Tidak boleh negatif"),
  description: z.string().optional(),
  isDefault: z.boolean(),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export function toCreateAccountPayload(values: AccountFormValues) {
  const currency = values.currency.trim().toUpperCase();
  return {
    name: values.name.trim(),
    account_type: values.accountType,
    currency,
    opening_balance_cents: toMinorUnits(values.openingBalance, currency),
    ...(values.description?.trim()
      ? { description: values.description.trim() }
      : {}),
    ...(values.isDefault ? { is_default: true } : {}),
  };
}

export function toUpdateAccountPayload(values: AccountFormValues): UpdateAccountPayload {
  return {
    name: values.name.trim(),
    account_type: values.accountType,
    currency: values.currency.trim().toUpperCase(),
    ...(values.description?.trim()
      ? { description: values.description.trim() }
      : {}),
  };
}