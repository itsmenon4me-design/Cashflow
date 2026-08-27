import { describe, it, expect, vi } from 'vitest';
import { budgetService, type CreateBudgetPayload } from './budget.service';
import { apiClient } from '@/lib/axios';

vi.mock('@/lib/axios', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('budget.service', () => {
  it('list calls /budgets and returns data', async () => {
    const mock = [{ id: 'b1', category_id: 'c1', budget_amount_cents: '1000', month: 8, year: 2026, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    mockedApi.get.mockResolvedValue({ data: mock });
    const res = await budgetService.list();
    expect(res).toEqual(mock);
    expect(apiClient.get).toHaveBeenCalledWith('/budgets');
  });

  it('create posts to /budgets', async () => {
    const payload: CreateBudgetPayload = {
      category_id: 'c1',
      budget_amount_cents: 1000,
      month: 8,
      year: 2026,
    };
    const returned = {
      id: 'b2',
      ...payload,
      budget_amount_cents: '1000',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockedApi.post.mockResolvedValue({ data: returned });
    const res = await budgetService.create(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/budgets', payload);
    expect(res).toEqual(returned);
  });

  it('analysis calls /reports/budget-analysis with params', async () => {
    const resp = { month: 8, year: 2026, overall: { budget: 100000, spent: 50000, remaining: 50000, percentageUsed: 50 }, categories: [] };
    mockedApi.get.mockResolvedValue(resp);
    const res = await budgetService.analysis(8, 2026);
    expect(apiClient.get).toHaveBeenCalledWith('/reports/budget-analysis', { params: { month: 8, year: 2026 } });
    expect(res).toEqual(resp);
  });
});
