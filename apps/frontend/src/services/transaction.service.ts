import { apiClient } from "@/lib/axios";
import { withOfflineCache } from "@/lib/offline/read-cache";
import { inputDateTimeToIso, isoToInputDate } from "@/lib/date";
import { toMajorUnits, toMinorUnits } from "@/lib/money";
import type {
  PaginatedTransactionResponse,
  TransactionDTO,
} from "@/types/backend";
import type { TransactionItem, TransactionType } from "@/types/dashboard";

export interface TransactionListParams {
  q?: string;
  page?: number;
  limit?: number;
  type?: "INCOME" | "EXPENSE";
  categoryId?: string;
  accountId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: "date" | "amount" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface CreateTransactionPayload {
  account_id: string;
  category_id: string;
  transaction_type: "INCOME" | "EXPENSE";
  amount_cents: number;
  transaction_date: string;
  note?: string;
}

export type UpdateTransactionPayload = Partial<CreateTransactionPayload>;

type NameLookup = Record<string, string>;

function findNameById(lookup: NameLookup, id: string): string {
  return lookup[id] ?? "-";
}

export function findIdByName(lookup: NameLookup, name: string): string | undefined {
  for (const [id, value] of Object.entries(lookup)) {
    if (value === name) {
      return id;
    }
  }
  return undefined;
}

function accountCurrency(
  values: CreateFormValues,
  accountNames: NameLookup,
  accountCurrencies: Record<string, string>,
): string {
  const accountId = findIdByName(accountNames, values.account);
  return accountId ? (accountCurrencies[accountId] ?? "IDR") : "IDR";
}

export function toTransactionItem(
  dto: TransactionDTO,
  accountNames: NameLookup,
  categoryNames: NameLookup,
  accountCurrencies: Record<string, string> = {},
): TransactionItem {
  return {
    id: dto.id,
    date: isoToInputDate(dto.transaction_date),
    dateTime: dto.transaction_date,
    category: findNameById(categoryNames, dto.category_id),
    description: dto.note ?? "",
    account: findNameById(accountNames, dto.account_id),
    amount: toMajorUnits(BigInt(dto.amount_cents), accountCurrencies[dto.account_id] ?? "IDR"),
    type: dto.transaction_type === "INCOME" ? "income" : "expense",
    status: "completed",
    note: dto.note ?? undefined,
  };
}

interface CreateFormValues {
  date: string;
  time?: string;
  type: TransactionType;
  category: string;
  account: string;
  amount: number;
  description?: string;
  notes?: string;
}

export function toCreateTransactionPayload(
  values: CreateFormValues,
  accountNames: NameLookup,
  categoryNames: NameLookup,
  accountCurrencies: Record<string, string>,
  // optional override: when parent wants to force a transaction type (e.g. incomes/expenses pages)
  forcedType?: 'income' | 'expense',
): CreateTransactionPayload | null {
  const accountId = findIdByName(accountNames, values.account);
  const categoryId = findIdByName(categoryNames, values.category);

  if (!accountId || !categoryId) {
    return null;
  }

  const note = values.notes?.trim() || values.description?.trim() || undefined;

  const typeSource = forcedType ?? values.type;

  return {
    account_id: accountId,
    category_id: categoryId,
    transaction_type: typeSource === "income" ? "INCOME" : "EXPENSE",
    amount_cents: toMinorUnits(
      values.amount,
      accountCurrency(values, accountNames, accountCurrencies),
    ),
    // Local wall time -> UTC instant: the database stores UTC, the UI renders local.
    transaction_date: inputDateTimeToIso(values.date, values.time),
    ...(note ? { note } : {}),
  };
}

export function toUpdateTransactionPayload(
  values: CreateFormValues,
  accountNames: NameLookup,
  categoryNames: NameLookup,
  accountCurrencies: Record<string, string>,
): UpdateTransactionPayload | null {
  const accountId = findIdByName(accountNames, values.account);
  const categoryId = findIdByName(categoryNames, values.category);

  if (!accountId || !categoryId) {
    return null;
  }

  const note = values.notes?.trim() || values.description?.trim() || undefined;

  return {
    account_id: accountId,
    category_id: categoryId,
    transaction_type: values.type === "income" ? "INCOME" : "EXPENSE",
    amount_cents: toMinorUnits(
      values.amount,
      accountCurrency(values, accountNames, accountCurrencies),
    ),
    transaction_date: inputDateTimeToIso(values.date, values.time),
    ...(note ? { note } : {}),
  };
}

export const transactionService = {
  list: (params: TransactionListParams = {}): Promise<PaginatedTransactionResponse> =>
    withOfflineCache(
      "transactions",
      `list:${JSON.stringify(params)}`,
      () => apiClient.get<PaginatedTransactionResponse>("/transactions", { params: { ...params } }),
    ),

  search: (q: string): Promise<PaginatedTransactionResponse> =>
    apiClient.get<PaginatedTransactionResponse>("/transactions/search", {
      params: { q, limit: 5 },
    }),

  create: (payload: CreateTransactionPayload): Promise<TransactionDTO> =>
    apiClient
      .post<{ success: boolean; data: TransactionDTO }>("/transactions", payload)
      .then((res) => res.data),

  update: (id: string, payload: UpdateTransactionPayload): Promise<TransactionDTO> =>
    apiClient
      .patch<{ success: boolean; data: TransactionDTO }>(`/transactions/${id}`, payload)
      .then((res) => res.data),

  remove: (id: string): Promise<{ success: boolean }> => {
    const url = `/transactions/${id}`;
    try {
      console.log('[DELETE FLOW] transaction.service.remove calling DELETE URL=', url);
    } catch (e) {}
    return apiClient.delete<{ success: boolean }>(url).then((res: any) => {
      try {
        console.log('[DELETE FLOW] transaction.service.remove response status=', res.status);
      } catch (e) {}
      return res.data;
    });
  },


};
