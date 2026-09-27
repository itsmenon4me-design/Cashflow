import ExcelJS from 'exceljs';
import { DateHelper } from '../../../common/utils/date.util';
import { ReportExportService } from './report-export.service';
import type { MonthlyReportService } from './monthly-report.service';
import type { CategoryBreakdownService } from './category-breakdown.service';
import type { CashflowTrendService } from './cashflow-trend.service';
import type { PrismaService } from '../../../database/prisma.service';

const makeMocks = (): {
  monthlySvc: MonthlyReportService;
  categorySvc: CategoryBreakdownService;
  trendSvc: CashflowTrendService;
  prisma: PrismaService;
} => {
  return {
    monthlySvc: {
      getMonthlyReport: jest.fn(() =>
        Promise.resolve({
          month: 8,
          year: 2026,
          summary: {
            income: '100',
            expense: '50',
            netCashFlow: '50',
            transactions: 3,
          },
        }),
      ),
    } as unknown as MonthlyReportService,
    categorySvc: {
      getBreakdown: jest.fn(() =>
        Promise.resolve({
          type: 'expense',
          total: '150',
          categories: [
            {
              categoryId: 'c1',
              categoryName: 'Food',
              totalAmount: '100',
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
            {
              period: '2026-07',
              income: '200',
              expense: '100',
              netCashFlow: '100',
            },
          ],
        }),
      ),
    } as unknown as CashflowTrendService,
    prisma: {
      transaction: {
        findMany: jest.fn(() => Promise.resolve([])),
        count: jest.fn(() => Promise.resolve(0)),
      },
    } as unknown as PrismaService,
  };
};

describe('ReportExportService', () => {
  it('exports monthly report as CSV', async () => {
    const mocks = makeMocks();
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.prisma,
    );
    const res = await svc.export({
      type: 'monthly',
      format: 'csv',
      month: 8,
      year: 2026,
      userId: 'user-1',
    });
    expect(res.filename).toContain('monthly-report-2026-08.csv');
    expect(res.contentType).toContain('text/csv');
    const content = String(res.content);
    expect(content).toContain('income');
    expect(content).toContain('100');
  });

  it('exports category breakdown as CSV with headers', async () => {
    const mocks = makeMocks();
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.prisma,
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

  it('exports trend as CSV', async () => {
    const mocks = makeMocks();
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.prisma,
    );
    const resCsv = await svc.export({
      type: 'trend',
      format: 'csv',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-31'),
      userId: 'user-1',
    });
    expect(resCsv.contentType).toContain('text/csv');
  });

  it('handles empty dataset (category CSV has only headers)', async () => {
    const mocks = makeMocks();
    mocks.categorySvc.getBreakdown = jest.fn(() =>
      Promise.resolve({ type: 'expense', total: '0', categories: [] }),
    );
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.prisma,
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
      mocks.prisma,
    );
    await expect(
      svc.export({
        type: 'foo' as unknown as 'monthly' | 'category' | 'trend',
        format: 'json' as unknown as 'csv' | 'xlsx',
        userId: 'user-1',
      }),
    ).rejects.toThrow();
    await expect(
      svc.export({
        type: 'monthly',
        format: 'xml' as unknown as 'csv' | 'xlsx',
        userId: 'user-1',
      }),
    ).rejects.toThrow();
  });

  it('exports a styled five-sheet workbook for the exact date range', async () => {
    const mocks = makeMocks();
    const findMany = mocks.prisma.transaction.findMany as jest.Mock;
    const count = mocks.prisma.transaction.count as jest.Mock;
    count.mockResolvedValueOnce(9).mockResolvedValueOnce(1);
    findMany
      .mockResolvedValueOnce([
        {
          id: 'current-income',
          transaction_date: new Date('2026-08-20T08:00:00.000Z'),
          transaction_type: 'INCOME',
          amount_cents: 100_000n,
          category_id: 'income-category',
          category: { name: 'Gaji' },
          note: 'Salary',
        },
        {
          id: 'current-expense',
          transaction_date: new Date('2026-08-20T09:00:00.000Z'),
          transaction_type: 'EXPENSE',
          amount_cents: 40_000n,
          category_id: 'food-category',
          category: { name: 'Makanan' },
          note: 'Lunch',
        },
        ...Array.from({ length: 7 }, (_, index) => ({
          id: `additional-expense-${index + 1}`,
          transaction_date: new Date(
            `2026-08-20T${String(10 + index).padStart(2, '0')}:00:00.000Z`,
          ),
          transaction_type: 'EXPENSE',
          amount_cents: 1_000n,
          category_id: 'food-category',
          category: { name: 'Makanan' },
          note: 'Additional transaction',
        })),
      ])
      .mockResolvedValueOnce([
        {
          id: 'previous-income',
          transaction_date: new Date('2026-08-19T08:00:00.000Z'),
          transaction_type: 'INCOME',
          amount_cents: 50_000n,
          category_id: 'income-category',
          category: { name: 'Gaji' },
          note: 'Previous income',
        },
      ]);
    (mocks.trendSvc.getTrend as jest.Mock).mockResolvedValue({
      type: 'daily',
      data: [
        {
          period: '2026-08-20',
          income: '100000',
          expense: '47000',
          netCashFlow: '53000',
        },
      ],
    });

    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.prisma,
    );
    const result = await svc.export({
      type: 'monthly',
      format: 'xlsx',
      startDate: DateHelper.startOfDay('2026-08-20'),
      endDate: DateHelper.endOfDay('2026-08-20'),
      userId: 'user-1',
    });

    expect(result.filename).toContain('2026-08-20-sampai-2026-08-20.xlsx');
    expect(result.contentType).toContain('spreadsheetml.sheet');
    expect(Buffer.isBuffer(result.content)).toBe(true);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ user_id: 'user-1', deleted_at: null }),
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.content as Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Ringkasan',
      'Tren Arus Kas',
      'Pengeluaran per Kategori',
      'Pemasukan per Kategori',
      'Rincian Transaksi',
    ]);
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('A5').value,
    ).toMatchObject({
      formula: expect.stringContaining('SUMIFS'),
      result: 100_000,
    });
    expect(
      (workbook.getWorksheet('Ringkasan')?.getCell('A5').value as {
        formula: string;
      }).formula,
    ).toContain("'Rincian Transaksi'!$J$2:$J$11");
    expect(
      (workbook.getWorksheet('Ringkasan')?.getCell('A5').value as {
        formula: string;
      }).formula,
    ).toContain("'Rincian Transaksi'!$K$2:$K$11");
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('G5').value,
    ).toMatchObject({
      formula: 'A5-D5',
      result: 53_000,
    });
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('A7').value,
    ).toMatchObject({
      formula: expect.stringContaining('TEXT'),
      result: '+100.0%',
    });
    expect(
      workbook.getWorksheet('Tren Arus Kas')?.getCell('B2').value,
    ).toMatchObject({
      formula: expect.stringContaining('SUMIFS'),
      result: 100_000,
    });
    expect(
      (workbook.getWorksheet('Tren Arus Kas')?.getCell('B2').value as {
        formula: string;
      }).formula,
    ).toContain("'Rincian Transaksi'!$J$2:$J$11");
    expect(
      (workbook.getWorksheet('Tren Arus Kas')?.getCell('B2').value as {
        formula: string;
      }).formula,
    ).toContain("'Rincian Transaksi'!$K$2:$K$11");
    expect(
      workbook.getWorksheet('Pengeluaran per Kategori')?.getCell('C2').value,
    ).toMatchObject({
      formula: expect.stringContaining('IFERROR'),
      result: 1,
    });
    expect(
      (
        workbook
          .getWorksheet('Pengeluaran per Kategori')
          ?.getCell('B2').value as { formula: string }
      ).formula,
    ).toContain("'Rincian Transaksi'!$K$2:$K$11");
    expect(
      (
        workbook
          .getWorksheet('Pengeluaran per Kategori')
          ?.getCell('B2').value as { formula: string }
      ).formula,
    ).toContain("'Rincian Transaksi'!$J$2:$J$11");
    const expenseSheet = workbook.getWorksheet('Pengeluaran per Kategori');
    expect(expenseSheet).toBeDefined();
    const expenseRules = expenseSheet
      ? (Reflect.get(expenseSheet, 'conditionalFormattings') as Array<{
          ref: string;
          rules: Array<Record<string, unknown>>;
        }>)
      : [];
    expect(expenseRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: 'C2:C2',
          rules: expect.arrayContaining([
            expect.objectContaining({
              type: 'dataBar',
              color: { argb: expect.stringMatching(/E58A82$/) },
            }),
          ]),
        }),
      ]),
    );
    expect(workbook.getWorksheet('Rincian Transaksi')?.autoFilter).toBe(
      'A1:H11',
    );
    expect(workbook.getWorksheet('Ringkasan')?.views[0].state).toBe('normal');
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('J5').value,
    ).toMatchObject({
      formula: expect.stringContaining('COUNTIF'),
      result: 9,
    });
    expect(workbook.getWorksheet('Rincian Transaksi')?.views[0].state).toBe(
      'frozen',
    );
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.views[0].showGridLines,
    ).toBe(false);
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.getCell('A2').font?.color,
    ).toMatchObject({
      argb: expect.stringMatching(/586575$/),
    });
    expect(workbook.getWorksheet('Rincian Transaksi')?.getColumn(10).hidden).toBe(
      true,
    );
    expect(workbook.getWorksheet('Rincian Transaksi')?.getColumn(11).hidden).toBe(
      true,
    );
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.getCell('J2').value,
    ).toBe('INCOME');
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.getCell('K2').value,
    ).toBe('Laporan');
  });

  it('creates valid formula totals for an empty date range', async () => {
    const mocks = makeMocks();
    const count = mocks.prisma.transaction.count as jest.Mock;
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    (mocks.trendSvc.getTrend as jest.Mock).mockResolvedValue({
      type: 'daily',
      data: [],
    });
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.prisma,
    );
    const result = await svc.export({
      type: 'monthly',
      format: 'xlsx',
      startDate: DateHelper.startOfDay('2026-08-20'),
      endDate: DateHelper.endOfDay('2026-08-20'),
      userId: 'user-1',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.content as Buffer);
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('A5').value,
    ).toMatchObject({
      formula: expect.stringContaining('SUMIFS'),
    });
    expect(workbook.getWorksheet('Ringkasan')?.getCell('A9').value).toBe(
      'Belum ada transaksi pada periode laporan.',
    );
    expect(
      workbook.getWorksheet('Tren Arus Kas')?.getCell('B2').value,
    ).toMatchObject({
      formula: 'SUM(0)',
    });
  });

  it('uses the full requested date range in CSV exports', async () => {
    const mocks = makeMocks();
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.prisma,
    );
    const result = await svc.export({
      type: 'monthly',
      format: 'csv',
      startDate: DateHelper.startOfDay('2026-01-10'),
      endDate: DateHelper.endOfDay('2026-02-05'),
      userId: 'user-1',
    });
    const content = String(result.content);
    expect(result.filename).toContain('2026-01-10-sampai-2026-02-05.csv');
    expect(content).toContain('periodStart,periodEnd');
    expect(content).toContain('2026-01-10,2026-02-05');
    expect(mocks.monthlySvc.getMonthlyReport).toHaveBeenCalledWith(
      'user-1',
      undefined,
      undefined,
      expect.objectContaining({
        start: DateHelper.startOfDay('2026-01-10'),
        end: DateHelper.endOfDay('2026-02-05'),
      }),
    );
  });

  it('loads transaction rows through cursor pages without stopping at the first batch', async () => {
    const mocks = makeMocks();
    const findMany = mocks.prisma.transaction.findMany as jest.Mock;
    const count = mocks.prisma.transaction.count as jest.Mock;
    count.mockResolvedValueOnce(1_001).mockResolvedValueOnce(0);
    const transaction = (index: number) => ({
      id: `tx-${String(index).padStart(4, '0')}`,
      transaction_date: new Date('2026-08-20T08:00:00.000Z'),
      transaction_type: 'EXPENSE',
      amount_cents: 1_000n,
      category_id: 'food-category',
      category: { name: 'Makanan' },
      note: '',
    });
    findMany
      .mockResolvedValueOnce(
        Array.from({ length: 1_000 }, (_, index) => transaction(index)),
      )
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([transaction(1_000)]);
    (mocks.trendSvc.getTrend as jest.Mock).mockResolvedValue({
      type: 'daily',
      data: [],
    });
    const svc = new ReportExportService(
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.prisma,
    );

    const result = await svc.export({
      type: 'monthly',
      format: 'xlsx',
      startDate: DateHelper.startOfDay('2026-08-20'),
      endDate: DateHelper.endOfDay('2026-08-20'),
      userId: 'user-1',
    });

    expect(findMany).toHaveBeenCalledTimes(3);
    expect(findMany.mock.calls[0][0].take).toBe(1_000);
    expect(findMany.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        cursor: { id: 'tx-0999' },
        skip: 1,
      }),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.content as Buffer);
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.getCell('A1002').value,
    ).toBe('tx-1000');
  });
});
