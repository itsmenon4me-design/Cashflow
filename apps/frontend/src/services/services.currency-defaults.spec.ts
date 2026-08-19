import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { reportService } from './report.service';
import { analyticsService } from './analytics.service';
import { dashboardService } from './dashboard.service';
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

describe('service currency defaults (frontend)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // set active dashboard currency to EUR for the tests
    useDashboardCurrencyStore.setState({ currency: 'EUR' });
  });

  it('reportService.getSummary uses active currency when omitted', async () => {
    mockedApi.get.mockResolvedValue({ data: {} });
    await reportService.getSummary({ startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(mockedApi.get).toHaveBeenCalled();
    const call = (mockedApi.get as any).mock.calls[0];
    expect(call[0]).toBe('/reports/monthly');
    expect(call[1]).toMatchObject({ params: expect.objectContaining({ currency: 'EUR' }) });
  });

  it('analyticsService.getOverview uses active currency when omitted', async () => {
    mockedApi.get.mockResolvedValue({ data: {} });
    await analyticsService.getOverview({ startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(mockedApi.get).toHaveBeenCalled();
    const call = (mockedApi.get as any).mock.calls[0];
    expect(call[0]).toBe('/analytics/overview');
    expect(call[1]).toMatchObject({ params: expect.objectContaining({ currency: 'EUR' }) });
  });

  it('dashboardService.getWidgets uses active currency when omitted', async () => {
    mockedApi.get.mockResolvedValue({ data: {} });
    await dashboardService.getWidgets();
    expect(mockedApi.get).toHaveBeenCalled();
    const call = (mockedApi.get as any).mock.calls[0];
    expect(call[0]).toBe('/dashboard/widgets');
    expect(call[1]).toMatchObject({ params: expect.objectContaining({ currency: 'EUR' }) });
  });
});
