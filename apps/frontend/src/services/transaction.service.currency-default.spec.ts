import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transactionService } from './transaction.service';
import { apiClient } from '@/lib/axios';
import { useDashboardCurrencyStore } from '@/stores/dashboardCurrency.store';

vi.mock('@/lib/axios', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = apiClient as unknown as { get: ReturnType<typeof vi.fn> };

describe('transaction.service currency defaulting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // ensure dashboard currency store is set to SGD for test
    useDashboardCurrencyStore.setState({ currency: 'SGD' });
  });

  it('adds active dashboard currency when list called without currency param', async () => {
    mockedApi.get.mockResolvedValue({ data: [], pagination: {} });

    await transactionService.list();

    expect(mockedApi.get).toHaveBeenCalled();
    const callArgs = (mockedApi.get as any).mock.calls[0];
    // first arg is the URL, second is options containing params
    expect(callArgs[0]).toBe('/transactions');
    expect(callArgs[1]).toMatchObject({ params: expect.objectContaining({ currency: 'SGD' }) });
  });
});
