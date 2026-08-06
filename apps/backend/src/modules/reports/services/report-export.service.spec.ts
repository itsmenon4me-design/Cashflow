import { ReportExportService } from './report-export.service';
import type { MonthlyReportService } from './monthly-report.service';
import type { CategoryBreakdownService } from './category-breakdown.service';
import type { CashflowTrendService } from './cashflow-trend.service';

const makeMocks = (): {
  monthlySvc: MonthlyReportService;
  categorySvc: CategoryBreakdownService;
  trendSvc: CashflowTrendService;
} => {
  return {
    monthlySvc: {
      getMonthlyReport: jest.fn(() =>
        Promise.resolve({
          month: 8,
          year: 2026,
          summary: {
            income: 100,
            expense: 50,
            netCashFlow: 50,
            transactions: 3,
          },
        }),
      ),
    } as unknown as MonthlyReportService,
    categorySvc: {
      getBreakdown: jest.fn(() =>
        Promise.resolve({
          type: 'expense',
          total: 150,
          categories: [
            {
              categoryId: 'c1',
              categoryName: 'Food',
              totalAmount: 100,
              percentage: 66.67,
              transactionCount: 4,
            },
          ],
        }),
      ),
    } as unknown as CategoryBreakdownService,
    trendSvc: {
      getTrend: jest.fn(() =>
        Promise.resolve({
          type: 'monthly',
          data: [
            { period: '2026-07', income: 200, expense: 100, netCashFlow: 100 },
          ],
        }),
      ),
    } as unknown as CashflowTrendService,
  };
};

describe('ReportExportService', () => {
  it('exports monthly report as JSON', async () => {
    const mocks = makeMocks();
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
    );
    const res = await svc.export({
      type: 'monthly',
      format: 'json',
      month: 8,
      year: 2026,
      userId: 'user-1',
    });
    expect(res.filename).toContain('monthly-report-2026-08');
    expect(res.contentType).toContain('application/json');
    const obj = JSON.parse(String(res.content)) as unknown as {
      summary: { income: number };
    };
    expect(obj.summary.income).toBe(100);
  });

  it('exports category breakdown as CSV with headers', async () => {
    const mocks = makeMocks();
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
    );
    const res = await svc.export({
      type: 'category',
      format: 'csv',
      month: 8,
      year: 2026,
      userId: 'user-1',
    });
    expect(res.filename).toContain('category-breakdown-2026-08');
    expect(res.contentType).toContain('text/csv');
    const content = String(res.content);
    expect(content).toContain('categoryId');
    expect(content).toContain('Food');
  });

  it('exports trend as CSV and JSON', async () => {
    const mocks = makeMocks();
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
    );
    const resCsv = await svc.export({
      type: 'trend',
      format: 'csv',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      userId: 'user-1',
    });
    expect(resCsv.contentType).toContain('text/csv');
    const resJson = await svc.export({
      type: 'trend',
      format: 'json',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      userId: 'user-1',
    });
    expect(resJson.contentType).toContain('application/json');
  });

  it('handles empty dataset (category CSV has only headers)', async () => {
    const mocks = makeMocks();
    mocks.categorySvc.getBreakdown = jest.fn(() =>
      Promise.resolve({ type: 'expense', total: 0, categories: [] }),
    );
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
    );
    const res = await svc.export({
      type: 'category',
      format: 'csv',
      month: 2,
      year: 2025,
      userId: 'user-1',
    });
    const content = String(res.content);
    // Should contain headers but no Food row
    expect(content).toContain('categoryId');
    expect(content).not.toContain('Food');
  });

  it('rejects invalid type and format', async () => {
    const mocks = makeMocks();
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
    );
    await expect(
      svc.export({
        type: 'foo' as unknown as 'monthly' | 'category' | 'trend',
        format: 'json',
        userId: 'user-1',
      }),
    ).rejects.toThrow();
    await expect(
      svc.export({
        type: 'monthly',
        format: 'xml' as unknown as 'json' | 'csv',
        userId: 'user-1',
      }),
    ).rejects.toThrow();
  });
});
