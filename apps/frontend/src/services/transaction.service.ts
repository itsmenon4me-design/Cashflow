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
  fromDate?: string;
  toDate?: string;
  sortBy?: "date" | "amount" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface CreateTransactionPayload {
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
  return Object.entries(lookup).find(([, value]) => value === name)?.[0];
}

export function toTransactionItem(dto: TransactionDTO, categoryNames: NameLookup): TransactionItem {
  return {
    id: dto.id,
    date: isoToInputDate(dto.transaction_date),
    dateTime: dto.transaction_date,
    category: findNameById(categoryNames, dto.category_id),
    description: dto.note ?? "",
    amount: toMajorUnits(BigInt(dto.amount_cents), "IDR"),
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
  amount: number;
  description?: string;
  notes?: string;
}

export function toCreateTransactionPayload(
  values: CreateFormValues,
  categoryNames: NameLookup,
  forcedType?: "income" | "expense",
): CreateTransactionPayload | null {
  const categoryId = findIdByName(categoryNames, values.category);
  if (!categoryId) return null;

  const note = values.notes?.trim() || values.description?.trim() || undefined;
  return {
    category_id: categoryId,
    transaction_type: (forcedType ?? values.type) === "income" ? "INCOME" : "EXPENSE",
    amount_cents: toMinorUnits(values.amount, "IDR"),
    transaction_date: inputDateTimeToIso(values.date, values.time),
    ...(note ? { note } : {}),
  };
}

export function toUpdateTransactionPayload(
  values: CreateFormValues,
  categoryNames: NameLookup,
): UpdateTransactionPayload | null {
  return toCreateTransactionPayload(values, categoryNames);
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
