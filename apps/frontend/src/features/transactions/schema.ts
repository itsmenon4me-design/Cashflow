import { z } from "zod";

const requiredMessage = "Wajib diisi";

export const transactionFormSchema = z.object({
  date: z.string().min(1, requiredMessage),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, requiredMessage),
  account: z.string().min(1, requiredMessage),
  amount: z.number({ error: "Nominal harus berupa angka" }).positive(requiredMessage),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
