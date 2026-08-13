import { apiClient } from '@/lib/axios';
import type { SuggestCategoryResponse } from '@/types/backend';

export interface SuggestCategoryRequest {
  description?: string;
  merchant?: string;
  amount?: number;
  transaction_type: 'INCOME' | 'EXPENSE';
}

export const aiService = {
  suggestCategory: (
    payload: SuggestCategoryRequest,
  ): Promise<SuggestCategoryResponse> =>
    apiClient
      .post<{ success: boolean; data: SuggestCategoryResponse }>(
        '/ai/transactions/suggest-category',
        payload,
      )
      .then((res) => res.data),
};
