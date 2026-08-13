import { SimpleAiProvider } from './simple-ai.provider';
import {
  AIProviderCategory,
  TransactionType,
} from '../interfaces/ai-provider.interface';

const CATEGORIES: AIProviderCategory[] = [
  { name: 'Food', type: 'EXPENSE' },
  { name: 'Salary', type: 'INCOME' },
  { name: 'Transport', type: 'EXPENSE' },
];

const REQUEST = (transactionType: TransactionType) => ({
  transactionType,
  categories: CATEGORIES,
});

describe('SimpleAiProvider', () => {
  const provider = new SimpleAiProvider();

  it('suggests a matched category with rule confidence', async () => {
    const result = await provider.suggestTransactionCategory({
      ...REQUEST('EXPENSE'),
      description: 'Dinner at restaurant',
    });

    expect(result.categoryName).toBe('Food');
    expect(result.confidence).toBe(0.9);
  });

  it('respects the transaction type when matching categories', async () => {
    const result = await provider.suggestTransactionCategory({
      ...REQUEST('INCOME'),
      description: 'restaurant',
    });

    expect(result.categoryName).toBe('Salary');
    expect(result.confidence).toBe(0.55);
  });

  it('falls back to a matching-type category for empty descriptions', async () => {
    const result = await provider.suggestTransactionCategory({
      ...REQUEST('EXPENSE'),
      description: '',
    });

    expect(result.categoryName).toBe('Food');
    expect(result.confidence).toBe(0.45);
  });

  it('returns an empty suggestion when no categories exist', async () => {
    const result = await provider.suggestTransactionCategory({
      transactionType: 'EXPENSE',
      categories: [],
      description: 'coffee',
    });

    expect(result).toEqual({
      categoryName: '',
      confidence: 0,
      reason: 'No categories are available for suggestion.',
    });
  });
});
