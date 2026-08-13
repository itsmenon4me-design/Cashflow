export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface AIProviderCategory {
  name: string;
  type: TransactionType;
}

export interface AIProviderRequest {
  description?: string;
  merchant?: string;
  amount?: number;
  transactionType: TransactionType;
  categories: AIProviderCategory[];
}

export interface AISuggestion {
  categoryName: string;
  confidence: number;
  reason?: string;
}

export interface AIProvider {
  suggestTransactionCategory(request: AIProviderRequest): Promise<AISuggestion>;
}
