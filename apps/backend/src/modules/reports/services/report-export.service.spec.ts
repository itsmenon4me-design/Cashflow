import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { DateHelper } from '../../../common/utils/date.util';
import { ReportExportService } from './report-export.service';
import {
  buildReportWorkbook,
  type WorkbookTransaction,
} from './report-workbook.builder';
import { CashflowTrendService } from './cashflow-trend.service';
import type { MonthlyReportService } from './monthly-report.service';
import type { CategoryBreakdownService } from './category-breakdown.service';
import type { CashflowTrendService } from './cashflow-trend.service';
import type { PrismaService } from '../../../database/prisma.service';

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

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
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
      transaction: {
        findMany: jest.fn(() => Promise.resolve([])),
        count: jest.fn(() => Promise.resolve(0)),
      },
    } as unknown as PrismaService,
  };
};

describe('ReportExportService', () => {
  it.each([
    [999n, 'Rp 999'],
    [750_000n, 'Rp 750 Rb'],
    [8_420_000n, 'Rp 8,42 Jt'],
    [850_000_000n, 'Rp 850 Jt'],
    [1_200_000_000n, 'Rp 1,2 M'],
    [2_500_000_000_000n, 'Rp 2,5 T'],
  ])(
    'formats doughnut totals compactly for %s rupiah',
    async (amount, expected) => {
      const content = await buildReportWorkbook({
        startDate: new Date('2026-09-01T00:00:00+07:00'),
        endDate: new Date('2026-09-01T23:59:59+07:00'),
        previousStartDate: new Date('2026-08-01T00:00:00+07:00'),
        previousEndDate: new Date('2026-08-31T23:59:59+07:00'),
        generatedAt: new Date('2026-10-01T00:00:00Z'),
        transactions: [
          {
            id: 'compact-amount',
            transactionDate: new Date('2026-09-01T12:00:00+07:00'),
            type: 'EXPENSE',
            amount,
            categoryId: 'category',
            categoryName: 'Contoh',
            note: 'Nilai asli tetap utuh',
            period: 'Laporan',
          },
        ],
        trendType: 'daily',
        trend: [],
        timeZone: 'Asia/Jakarta',
      });
      const zip = await JSZip.loadAsync(content);
      const centerLabel = await zip
        .file('xl/drawings/drawing5.xml')
        ?.async('string');
      expect(centerLabel).toContain(expected);
    },
  );

  it('uses every trend period and category in charts and keeps print layouts to one page', async () => {
    const transactions: WorkbookTransaction[] = [
      {
        id: 'expense-food',
        transactionDate: new Date('2026-09-01T12:00:00+07:00'),
        type: 'EXPENSE',
        amount: 8_420_000n,
        categoryId: 'food',
        categoryName: 'Makanan',
        note: 'Belanja bulanan',
        period: 'Laporan',
      },
      {
        id: 'expense-transport',
        transactionDate: new Date('2026-09-02T12:00:00+07:00'),
        type: 'EXPENSE',
        amount: 3_000_000n,
        categoryId: 'transport',
        categoryName: 'Transportasi',
        note: 'Transportasi',
        period: 'Laporan',
      },
      {
        id: 'income-salary',
        transactionDate: new Date('2026-09-01T12:00:00+07:00'),
        type: 'INCOME',
        amount: 12_750_000n,
        categoryId: 'salary',
        categoryName: 'Gaji',
        note: 'Gaji bulanan',
        period: 'Laporan',
      },
      {
        id: 'income-bonus',
        transactionDate: new Date('2026-09-02T12:00:00+07:00'),
        type: 'INCOME',
        amount: 2_500_000n,
        categoryId: 'bonus',
        categoryName: 'Bonus',
        note: 'Bonus',
        period: 'Laporan',
      },
    ];
    const content = await buildReportWorkbook({
      startDate: new Date('2026-09-01T00:00:00+07:00'),
      endDate: new Date('2026-09-02T23:59:59+07:00'),
      previousStartDate: new Date('2026-08-30T00:00:00+07:00'),
      previousEndDate: new Date('2026-08-31T23:59:59+07:00'),
      generatedAt: new Date('2026-10-01T00:00:00Z'),
      transactions,
      trendType: 'daily',
      trend: [
        {
          period: '2026-09-01',
          income: '12750000',
          expense: '8420000',
          netCashFlow: '4330000',
        },
        {
          period: '2026-09-02',
          income: '2500000',
          expense: '3000000',
          netCashFlow: '-500000',
        },
      ],
      timeZone: 'Asia/Jakarta',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content);
    const zip = await JSZip.loadAsync(content);
    const chart1 = await zip.file('xl/charts/chart1.xml')?.async('string');
    const chart2 = await zip.file('xl/charts/chart2.xml')?.async('string');
    const chart4 = await zip.file('xl/charts/chart4.xml')?.async('string');
    const chart5 = await zip.file('xl/charts/chart5.xml')?.async('string');
    const chart6 = await zip.file('xl/charts/chart6.xml')?.async('string');
    const chart7 = await zip.file('xl/charts/chart7.xml')?.async('string');
    const chart8 = await zip.file('xl/charts/chart8.xml')?.async('string');
    const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
    const summaryDrawing = await zip
      .file('xl/drawings/drawing1.xml')
      ?.async('string');
    const expenseCenter = await zip
      .file('xl/drawings/drawing5.xml')
      ?.async('string');
    const incomeCenter = await zip
      .file('xl/drawings/drawing6.xml')
      ?.async('string');

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Ringkasan',
      'Tren Arus Kas',
      'Pengeluaran per Kategori',
      'Pemasukan per Kategori',
      'Rincian Transaksi',
    ]);
    expect(chart1).toContain('&apos;Ringkasan&apos;!NeracaTrendPeriods');
    expect(chart1).toContain('&apos;Ringkasan&apos;!NeracaTrendIncome');
    expect(chart1).toContain('&apos;Ringkasan&apos;!NeracaTrendExpense');
    expect(workbookXml).toContain('name="NeracaTrendPeriods"');
    expect(workbookXml).toContain('name="NeracaTrendIncome"');
    expect(workbookXml).toContain('name="NeracaTrendExpense"');
    expect(workbookXml).toContain(
      'COUNTA(&apos;Tren Arus Kas&apos;!$A$31:$A$1048576)',
    );
    expect(chart1).toContain('<c:ptCount val="2"/>');
    expect(summaryDrawing).toContain(
      '<xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>10</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>20</xdr:row>',
    );
    expect(summaryDrawing).toContain(
      '<xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>28</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>36</xdr:row>',
    );
    expect(chart2).toContain('<c:doughnutChart>');
    expect(chart4).toContain('<c:barChart>');
    expect(chart4).toContain('<c:lineChart>');
    expect(chart4).toContain('TrendData[Arus Kas Bersih]');
    expect(
      chart4
        ?.match(/<c:barChart>[\s\S]*?<\/c:barChart>/)?.[0]
        .match(/<c:ser>/g),
    ).toHaveLength(2);
    expect(
      chart4
        ?.match(/<c:lineChart>[\s\S]*?<\/c:lineChart>/)?.[0]
        .match(/<c:ser>/g),
    ).toHaveLength(1);
    expect(chart4).toContain('<c:v>Net Cash Flow</c:v>');
    expect(chart5).toContain('<c:doughnutChart>');
    expect(chart6).toContain('<c:barDir val="bar"/>');
    expect(chart6).toContain('<c:tickLblPos val="none"/>');
    expect(chart6).toContain('<c:crosses val="autoZero"/>');
    expect(chart6).toContain('<c:dPt><c:idx val="0"/>');
    expect(chart6).toContain('<a:srgbClr val="B76A61"/>');
    expect(chart6).not.toContain('<c:legend>');
    expect(chart7).toContain('<c:doughnutChart>');
    expect(chart8).toContain('<c:barDir val="bar"/>');
    expect(chart8).toContain('<c:tickLblPos val="none"/>');
    expect(chart8).toContain('<c:dPt><c:idx val="0"/>');
    expect(chart8).toContain('<a:srgbClr val="4E8B70"/>');
    expect(chart8).not.toContain('<c:legend>');
    expect(chart5).toContain('ExpenseCategoryData[Kategori]');
    expect(chart5).toContain('ExpenseCategoryData[Nominal]');
    expect(chart8).toContain('IncomeCategoryData[Kategori]');
    expect(chart8).toContain('IncomeCategoryData[Nominal]');
    expect(expenseCenter).toContain('Rp 11,42 Jt');
    expect(expenseCenter).toContain('Total Pengeluaran');
    expect(expenseCenter).toContain('wrap="none"');
    expect(incomeCenter).toContain('Rp 15,25 Jt');
    expect(incomeCenter).toContain('Total Pemasukan');
    expect(workbook.creator).toBe('Neraca');
    expect(workbook.title).toBe('Neraca');
    expect(workbook.getWorksheet('Ringkasan')?.getCell('A1').value).toBe(
      'Neraca',
    );
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('A5').value,
    ).toMatchObject({
      result: 15_250_000,
    });
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('D5').value,
    ).toMatchObject({
      result: 11_420_000,
    });
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('G5').value,
    ).toMatchObject({
      result: 3_830_000,
    });
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('J5').value,
    ).toMatchObject({
      result: 4,
    });
    expect(workbook.getWorksheet('Ringkasan')?.pageSetup.fitToHeight).toBe(1);
    expect(workbook.getWorksheet('Tren Arus Kas')?.pageSetup.fitToHeight).toBe(
      1,
    );
    expect(
      workbook.getWorksheet('Pengeluaran per Kategori')?.pageSetup.fitToHeight,
    ).toBe(1);
    expect(
      workbook.getWorksheet('Pemasukan per Kategori')?.pageSetup.fitToHeight,
    ).toBe(1);
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.getTables(),
    ).toHaveLength(1);
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.getImages(),
    ).toHaveLength(0);
  });

  it('keeps one-category and one-period charts limited to the actual data', async () => {
    const content = await buildReportWorkbook({
      startDate: new Date('2026-09-01T00:00:00+07:00'),
      endDate: new Date('2026-09-01T23:59:59+07:00'),
      previousStartDate: new Date('2026-08-01T00:00:00+07:00'),
      previousEndDate: new Date('2026-08-31T23:59:59+07:00'),
      generatedAt: new Date('2026-10-01T00:00:00Z'),
      transactions: [
        {
          id: 'only-expense',
          transactionDate: new Date('2026-09-01T12:00:00+07:00'),
          type: 'EXPENSE',
          amount: 750_000n,
          categoryId: 'single-category',
          categoryName: 'Satu kategori',
          note: 'Transaksi aktual',
          period: 'Laporan',
        },
      ],
      trendType: 'daily',
      trend: [
        {
          period: '2026-09-01',
          income: '0',
          expense: '750000',
          netCashFlow: '-750000',
        },
      ],
      timeZone: 'Asia/Jakarta',
    });
    const zip = await JSZip.loadAsync(content);
    const readChart = async (chartNumber: number) =>
      zip.file(`xl/charts/chart${chartNumber}.xml`)?.async('string');
    const [
      summaryTrend,
      summaryExpense,
      summaryIncome,
      trendCombo,
      expenseBar,
    ] = await Promise.all([1, 2, 3, 4, 6].map(readChart));
    const expenseCategoryCache = summaryExpense?.match(
      /<c:cat>[\s\S]*?<\/c:cat>/,
    )?.[0];
    const incomeCategoryCache = summaryIncome?.match(
      /<c:cat>[\s\S]*?<\/c:cat>/,
    )?.[0];

    expect(summaryTrend).toContain('<c:ptCount val="1"/>');
    expect(summaryTrend).toContain('&apos;Ringkasan&apos;!NeracaTrendPeriods');
    expect(expenseCategoryCache).toContain('<c:ptCount val="1"/>');
    expect(expenseCategoryCache).toContain('<c:v>Satu kategori</c:v>');
    expect(incomeCategoryCache).toContain('<c:ptCount val="0"/>');
    expect(incomeCategoryCache).not.toContain('Belum ada data');
    expect(trendCombo).toContain('TrendData[Arus Kas Bersih]');
    expect(expenseBar).toContain('ExpenseCategoryData[Nominal]');
    expect(
      [summaryTrend, summaryExpense, summaryIncome, trendCombo, expenseBar]
        .filter(Boolean)
        .join(''),
    ).not.toContain('Tidak ada data');
  });

  it('keeps user-zone transaction dates, trend buckets, and formula caches aligned', async () => {
    const transactions = [
      {
        id: 'august-income',
        transaction_date: new Date('2026-08-31T23:59:00+07:00'),
        transaction_type: 'INCOME',
        amount_cents: 1_000n,
        category_id: 'income',
        category: { name: 'Income' },
        note: '',
      },
      {
        id: 'september-expense',
        transaction_date: new Date('2026-09-01T03:00:00+07:00'),
        transaction_type: 'EXPENSE',
        amount_cents: 200n,
        category_id: 'expense',
        category: { name: 'Expense' },
        note: '',
      },
      {
        id: 'monday-income',
        transaction_date: new Date('2026-09-07T00:30:00+07:00'),
        transaction_type: 'INCOME',
        amount_cents: 300n,
        category_id: 'income',
        category: { name: 'Income' },
        note: '',
      },
    ];
    const dailyMilliseconds = 86_400_000;
    const excelSerialForDay = (date: Date) =>
      Math.floor(date.getTime() / dailyMilliseconds) + 25_569;
    const formulaBounds = (formula: string): [number, number] => {
      const dates = Array.from(
        formula.matchAll(/DATE\((\d+),(\d+),(\d+)\)/g),
        (match) =>
          Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) /
            dailyMilliseconds +
          25_569,
      );
      expect(dates).toHaveLength(2);
      return [dates[0], dates[1]];
    };
    const cachedCellValue = (xml: string, address: string): number => {
      const cell = xml.match(
        new RegExp(`<c\\b[^>]*\\br="${address}"[^>]*>([\\s\\S]*?)</c>`),
      );
      const value = cell?.[1].match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (value === undefined) {
        throw new Error(`Missing cached formula value for ${address}`);
      }
      return Number(value);
    };

    const cases = [
      {
        type: 'daily' as const,
        start: DateHelper.startOfDay('2026-08-31'),
        end: DateHelper.endOfDay('2026-09-07'),
        expected: [
          ['2026-08-31', '1000', '0'],
          ['2026-09-01', '0', '200'],
          ['2026-09-07', '300', '0'],
        ],
      },
      {
        type: 'weekly' as const,
        start: DateHelper.startOfDay('2026-08-01'),
        end: DateHelper.endOfDay('2026-09-30'),
        expected: [
          ['2026-W36', '1000', '200'],
          ['2026-W37', '300', '0'],
        ],
      },
      {
        type: 'monthly' as const,
        start: DateHelper.startOfDay('2026-01-01'),
        end: DateHelper.endOfDay('2026-09-30'),
        expected: [
          ['2026-08', '1000', '0'],
          ['2026-09', '300', '200'],
        ],
      },
    ];

    for (const { type, start, end, expected } of cases) {
      const mocks = makeMocks();
      (mocks.prisma.transaction.count as jest.Mock)
        .mockResolvedValueOnce(transactions.length)
        .mockResolvedValueOnce(0);
      (mocks.prisma.transaction.findMany as jest.Mock)
        .mockResolvedValueOnce(transactions)
        .mockResolvedValueOnce([]);
      const trendPrisma = {
        userSettings: {
          findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
        },
        transaction: {
          findMany: jest.fn().mockResolvedValue(transactions),
        },
      };
      const trendSvc = new CashflowTrendService(
        trendPrisma as unknown as PrismaService,
      );
      const exporter = new ReportExportService(
        mocks.monthlySvc,
        mocks.categorySvc,
        trendSvc,
        mocks.prisma,
      );
      const result = await exporter.export({
        type: 'monthly',
        format: 'xlsx',
        startDate: start,
        endDate: end,
        userId: 'user-1',
      });

      if (type === 'daily') {
        const mocks = makeMocks();
        const exporter = new ReportExportService(
          mocks.monthlySvc,
          mocks.categorySvc,
          mocks.trendSvc,
          mocks.prisma,
        );
        const start = DateHelper.startOfCalendarMonthInTimezone(
          2026,
          9,
          'Asia/Jakarta',
        );
        const end = DateHelper.endOfCalendarMonthInTimezone(
          2026,
          9,
          'Asia/Jakarta',
        );

        await exporter.export({
          type: 'monthly',
          format: 'xlsx',
          startDate: start,
          endDate: end,
          userId: 'user-1',
        });

        for (const [timeZone, offset] of [
          ['Asia/Jakarta', '+07:00'],
          ['Asia/Makassar', '+08:00'],
          ['Asia/Jayapura', '+09:00'],
        ] as const) {
          const transactions: WorkbookTransaction[] = [
            {
              id: 'before-september',
              transactionDate: new Date(`2026-08-31T23:59:00${offset}`),
              type: 'INCOME',
              amount: 1_000n,
              categoryId: 'income',
              categoryName: 'Income',
              note: '',
              period: 'Laporan',
            },
            {
              id: 'september-first',
              transactionDate: new Date(`2026-09-01T03:00:00${offset}`),
              type: 'EXPENSE',
              amount: 200n,
              categoryId: 'expense',
              categoryName: 'Expense',
              note: '',
              period: 'Laporan',
            },
            {
              id: 'monday-0030',
              transactionDate: new Date(`2026-09-07T00:30:00${offset}`),
              type: 'INCOME',
              amount: 300n,
              categoryId: 'income',
              categoryName: 'Income',
              note: '',
              period: 'Laporan',
            },
          ];
          const startDate = DateHelper.startOfDayInTimezone(
            '2026-08-31',
            timeZone,
          );
          const endDate = DateHelper.endOfDayInTimezone('2026-09-07', timeZone);
          const expectedByType = {
            daily: [
              ['2026-08-31', 1_000, 0],
              ['2026-09-01', 0, 200],
              ['2026-09-07', 300, 0],
            ],
            weekly: [
              ['2026-W36', 1_000, 200],
              ['2026-W37', 300, 0],
            ],
            monthly: [
              ['2026-08', 1_000, 0],
              ['2026-09', 300, 200],
            ],
          } as const;

          for (const trendType of ['daily', 'weekly', 'monthly'] as const) {
            const trend = expectedByType[trendType].map(
              ([period, income, expense]) => ({
                period,
                income: String(income),
                expense: String(expense),
                netCashFlow: String(income - expense),
              }),
            );
            const content = await buildReportWorkbook({
              startDate,
              endDate,
              previousStartDate: DateHelper.startOfDayInTimezone(
                '2026-08-01',
                timeZone,
              ),
              previousEndDate: DateHelper.endOfDayInTimezone(
                '2026-08-30',
                timeZone,
              ),
              generatedAt: new Date('2026-09-15T05:00:00.000Z'),
              transactions,
              trendType,
              trend,
              timeZone,
            });
            const workbookZip = await JSZip.loadAsync(content);
            const trendXml = await workbookZip
              .file('xl/worksheets/sheet2.xml')
              ?.async('string');
            const summaryXml = await workbookZip
              .file('xl/worksheets/sheet1.xml')
              ?.async('string');
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(content);
            const details = workbook.getWorksheet('Rincian Transaksi');
            const trendSheet = workbook.getWorksheet('Tren Arus Kas');
            const summary = workbook.getWorksheet('Ringkasan');
            expect(details).toBeDefined();
            expect(trendSheet).toBeDefined();
            expect(summary).toBeDefined();
            if (!trendXml || !summaryXml) {
              throw new Error('Missing workbook worksheet XML');
            }
            expect(
              [2, 3, 4].map((row) => {
                const date = details?.getCell(row, 2).value;
                return date instanceof Date
                  ? date.toISOString().slice(0, 10)
                  : date;
              }),
            ).toEqual(['2026-08-31', '2026-09-01', '2026-09-07']);
            expect(
              trendSheet
                ?.getColumn(1)
                .values.slice(31, 31 + expectedByType[trendType].length),
            ).toEqual(expectedByType[trendType].map(([period]) => period));
            const formatPeriodDate = (date: Date) =>
              new Intl.DateTimeFormat('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                timeZone,
              }).format(date);
            expect(summary?.getCell('I2').text).toContain(
              formatPeriodDate(startDate),
            );
            expect(summary?.getCell('I2').text).toContain(
              formatPeriodDate(endDate),
            );
            expect(cachedCellValue(summaryXml, 'A5')).toBe(1_300);
            expect(cachedCellValue(summaryXml, 'D5')).toBe(200);

            for (
              let index = 0;
              index < expectedByType[trendType].length;
              index += 1
            ) {
              const row = index + 31;
              const point = expectedByType[trendType][index];
              for (const [column, transactionType, expected] of [
                [2, 'INCOME', point[1]],
                [3, 'EXPENSE', point[2]],
              ] as const) {
                const formulaValue = trendSheet?.getCell(row, column)
                  .value as ExcelJS.CellFormulaValue;
                expect(
                  cachedCellValue(
                    trendXml,
                    `${String.fromCharCode(64 + column)}${row}`,
                  ),
                ).toBe(expected);
                const formulaDates = Array.from(
                  formulaValue.formula.matchAll(/DATE\((\d+),(\d+),(\d+)\)/g),
                  (match) =>
                    Date.UTC(
                      Number(match[1]),
                      Number(match[2]) - 1,
                      Number(match[3]),
                    ) /
                      86_400_000 +
                    25_569,
                );
                expect(formulaDates).toHaveLength(2);
                const recomputed = transactions
                  .filter((transaction) => {
                    const transactionRow =
                      transactions.indexOf(transaction) + 2;
                    const date = details?.getCell(transactionRow, 2).value;
                    const serial =
                      date instanceof Date
                        ? Math.floor(date.getTime() / 86_400_000) + 25_569
                        : Number.NaN;
                    const type = details?.getCell(transactionRow, 10).value;
                    const period = details?.getCell(transactionRow, 11).value;
                    return (
                      type === transactionType &&
                      period === 'Laporan' &&
                      serial >= formulaDates[0] &&
                      serial < formulaDates[1]
                    );
                  })
                  .reduce(
                    (sum, transaction) => sum + Number(transaction.amount),
                    0,
                  );
                expect(recomputed).toBe(expected);
              }
              const netValue = trendSheet?.getCell(row, 4)
                .value as ExcelJS.CellFormulaValue;
              expect(netValue.formula).toBe(`B${row}-C${row}`);
              expect(cachedCellValue(trendXml, `D${row}`)).toBe(
                point[1] - point[2],
              );
            }
          }
        }

        const queries = (mocks.prisma.transaction.findMany as jest.Mock).mock
          .calls;
        expect(queries[0][0].where.transaction_date).toEqual({
          gte: start,
          lte: end,
        });
        expect(queries[1][0].where.transaction_date).toEqual({
          gte: DateHelper.startOfCalendarMonthInTimezone(
            2026,
            8,
            'Asia/Jakarta',
          ),
          lte: new Date(start.getTime() - 1),
        });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.content);
      const workbookZip = await JSZip.loadAsync(result.content);
      const trendXml = await workbookZip
        .file('xl/worksheets/sheet2.xml')
        ?.async('string');
      const details = workbook.getWorksheet('Rincian Transaksi');
      const trend = workbook.getWorksheet('Tren Arus Kas');
      const summary = workbook.getWorksheet('Ringkasan');
      expect(details).toBeDefined();
      expect(trend).toBeDefined();
      expect(summary).toBeDefined();
      if (!trendXml) throw new Error('Missing cashflow trend worksheet XML');
      expect(
        [2, 3, 4].map((row) => {
          const value = details?.getCell(row, 2).value;
          return value instanceof Date
            ? new Date(value.getTime()).toISOString().slice(0, 10)
            : value;
        }),
      ).toEqual(['2026-08-31', '2026-09-01', '2026-09-07']);

      const actualTrend = await trendSvc.getTrend('user-1', type, start, end);
      expect(
        actualTrend.data.map(({ period, income, expense }) => [
          period,
          income,
          expense,
        ]),
      ).toEqual(expected);
      expect(summary?.getCell('A5').value).toMatchObject({ result: 1_300 });
      expect(summary?.getCell('D5').value).toMatchObject({ result: 200 });

      expected.forEach(([period], index) => {
        const row = index + 31;
        expect(trend?.getCell(row, 1).value).toBe(period);

        for (const [column, typeName] of [
          [2, 'INCOME'],
          [3, 'EXPENSE'],
        ] as const) {
          const formulaValue = trend?.getCell(row, column).value as {
            formula: string;
            result: number;
          };
          const [lower, upper] = formulaBounds(formulaValue.formula);
          const cached = cachedCellValue(
            trendXml,
            `${String.fromCharCode(64 + column)}${row}`,
          );
          const formulaType = formulaValue.formula.includes('"INCOME"')
            ? 'INCOME'
            : 'EXPENSE';
          expect(formulaType).toBe(typeName);
          const recalculated = [2, 3, 4].reduce((sum, detailRow) => {
            const date = details?.getCell(detailRow, 2).value;
            const amount = details?.getCell(detailRow, 6).value;
            const rowType = details?.getCell(detailRow, 10).value;
            const dataPeriod = details?.getCell(detailRow, 11).value;
            if (
              date instanceof Date &&
              typeof amount === 'number' &&
              rowType === formulaType &&
              dataPeriod === 'Laporan' &&
              excelSerialForDay(date) >= lower &&
              excelSerialForDay(date) < upper
            ) {
              return sum + amount;
            }
            return sum;
          }, 0);
          expect(cached).toBe(recalculated);
        }
      });
    }
  });

  it.each([
    ['Asia/Jakarta', '+07:00'],
    ['Asia/Makassar', '+08:00'],
    ['Asia/Jayapura', '+09:00'],
    [undefined, '+07:00'],
  ] as const)(
    'exports localized XLSX dates and matching trend formulas for %s',
    async (configuredTimeZone, offset) => {
      const previousDefaultTimeZone = process.env.APP_DEFAULT_TIMEZONE;
      delete process.env.APP_DEFAULT_TIMEZONE;
      try {
        const timeZone = configuredTimeZone ?? 'Asia/Jakarta';
        const transactions = [
          {
            id: 'august-last-minute',
            transaction_date: new Date(`2026-08-31T23:59:00${offset}`),
            transaction_type: 'INCOME',
            amount_cents: 1_000n,
            category_id: 'income-category',
            category: { name: 'Income' },
            note: 'End of August',
          },
          {
            id: 'september-first-half-hour',
            transaction_date: new Date(`2026-09-01T00:30:00${offset}`),
            transaction_type: 'EXPENSE',
            amount_cents: 200n,
            category_id: 'expense-category',
            category: { name: 'Expense' },
            note: 'Start of September',
          },
          {
            id: 'monday-first-half-hour',
            transaction_date: new Date(`2026-09-07T00:30:00${offset}`),
            transaction_type: 'INCOME',
            amount_cents: 300n,
            category_id: 'income-category',
            category: { name: 'Income' },
            note: 'Monday boundary',
          },
        ];
        const ranges = [
          {
            start: DateHelper.startOfDayInTimezone('2026-08-31', timeZone),
            end: DateHelper.endOfDayInTimezone('2026-09-07', timeZone),
            periods: [
              ['2026-08-31', 1_000, 0],
              ['2026-09-01', 0, 200],
              ['2026-09-07', 300, 0],
            ],
          },
          {
            start: DateHelper.startOfDayInTimezone('2026-08-01', timeZone),
            end: DateHelper.endOfDayInTimezone('2026-09-30', timeZone),
            periods: [
              ['2026-W36', 1_000, 200],
              ['2026-W37', 300, 0],
            ],
          },
          {
            start: DateHelper.startOfDayInTimezone('2026-01-01', timeZone),
            end: DateHelper.endOfDayInTimezone('2026-09-30', timeZone),
            periods: [
              ['2026-08', 1_000, 0],
              ['2026-09', 300, 200],
            ],
          },
        ] as const;
        const dailyMilliseconds = 86_400_000;
        const excelSerialForDay = (date: Date) =>
          Math.floor(date.getTime() / dailyMilliseconds) + 25_569;
        const formulaBounds = (formula: string): [number, number] => {
          const dates = Array.from(
            formula.matchAll(/DATE\((\d+),(\d+),(\d+)\)/g),
            (match) =>
              Date.UTC(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3]),
              ) /
                dailyMilliseconds +
              25_569,
          );
          expect(dates).toHaveLength(2);
          return [dates[0], dates[1]];
        };

        for (const { start, end, periods } of ranges) {
          const mocks = makeMocks();
          mocks.prisma.userSettings!.findUnique = jest
            .fn()
            .mockResolvedValue(
              configuredTimeZone ? { timezone: configuredTimeZone } : null,
            );
          const findMany = mocks.prisma.transaction.findMany as jest.Mock;
          findMany
            .mockResolvedValueOnce(transactions)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(transactions);
          (mocks.prisma.transaction.count as jest.Mock)
            .mockResolvedValueOnce(transactions.length)
            .mockResolvedValueOnce(0);

          const trendService = new CashflowTrendService(mocks.prisma);
          const exporter = new ReportExportService(
            mocks.monthlySvc,
            mocks.categorySvc,
            trendService,
            mocks.prisma,
          );
          const result = await exporter.export({
            type: 'monthly',
            format: 'xlsx',
            startDate: start,
            endDate: end,
            userId: 'user-1',
          });
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(result.content);
          const workbookZip = await JSZip.loadAsync(result.content);
          const trendXml = await workbookZip
            .file('xl/worksheets/sheet2.xml')
            ?.async('string');
          const details = workbook.getWorksheet('Rincian Transaksi');
          const trend = workbook.getWorksheet('Tren Arus Kas');
          const summary = workbook.getWorksheet('Ringkasan');
          expect(details).toBeDefined();
          expect(trend).toBeDefined();
          expect(summary).toBeDefined();
          if (!trendXml) throw new Error('Missing trend worksheet XML');
          expect(mocks.prisma.userSettings!.findUnique).toHaveBeenCalledTimes(
            1,
          );
          expect(
            [2, 3, 4].map((row) => {
              const value = details?.getCell(row, 2).value;
              if (!(value instanceof Date)) {
                throw new Error('XLSX detail date was not written as a date');
              }
              return value.toISOString().slice(0, 10);
            }),
          ).toEqual(['2026-08-31', '2026-09-01', '2026-09-07']);
          const formatPeriodDate = (date: Date) =>
            new Intl.DateTimeFormat('id-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              timeZone,
            }).format(date);
          expect(summary?.getCell('I2').text).toContain(
            formatPeriodDate(start),
          );
          expect(summary?.getCell('I2').text).toContain(formatPeriodDate(end));
          expect(summary?.getCell('A5').value).toMatchObject({ result: 1_300 });
          expect(summary?.getCell('D5').value).toMatchObject({ result: 200 });

          for (let index = 0; index < periods.length; index += 1) {
            const row = index + 31;
            const [period, expectedIncome, expectedExpense] = periods[index];
            expect(trend?.getCell(row, 1).value).toBe(period);
            for (const [column, expected] of [
              [2, expectedIncome],
              [3, expectedExpense],
            ] as const) {
              const formulaValue = trend?.getCell(row, column)
                .value as ExcelJS.CellFormulaValue;
              const bounds = formulaBounds(formulaValue.formula);
              const recomputed = transactions.reduce((sum, transaction, i) => {
                const date = details?.getCell(i + 2, 2).value;
                const serial =
                  date instanceof Date ? excelSerialForDay(date) : NaN;
                const type = details?.getCell(i + 2, 10).value;
                const periodKey = details?.getCell(i + 2, 11).value;
                const formulaType = column === 2 ? 'INCOME' : 'EXPENSE';
                return type === formulaType &&
                  periodKey === 'Laporan' &&
                  serial >= bounds[0] &&
                  serial < bounds[1]
                  ? sum + Number(transaction.amount_cents)
                  : sum;
              }, 0);
              const cachedCell = trendXml.match(
                new RegExp(
                  `<c\\b[^>]*\\br="${String.fromCharCode(64 + column)}${row}"[^>]*>([\\s\\S]*?)</c>`,
                ),
              );
              const cachedValue =
                cachedCell?.[1].match(/<v>([\s\S]*?)<\/v>/)?.[1];
              expect(cachedValue).toBeDefined();
              expect(Number(cachedValue)).toBe(expected);
              expect(recomputed).toBe(expected);
            }
          }
          expect(trend?.rowCount).toBe(periods.length + 31);
        }
      } finally {
        if (previousDefaultTimeZone === undefined) {
          delete process.env.APP_DEFAULT_TIMEZONE;
        } else {
          process.env.APP_DEFAULT_TIMEZONE = previousDefaultTimeZone;
        }
      }
    },
  );

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

  it('starts a default trend export in the current WIB year under TZ=UTC', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-31T18:00:00.000Z'));
    try {
      const mocks = makeMocks();
      const svc = new ReportExportService(
        mocks.monthlySvc,
        mocks.categorySvc,
        mocks.trendSvc,
        mocks.prisma,
      );

      await svc.export({
        type: 'trend',
        format: 'csv',
        userId: 'user-1',
      });

      const trendRequest = Reflect.get(mocks.trendSvc, 'getTrend') as jest.Mock;
      expect(trendRequest).toHaveBeenCalledWith(
        'user-1',
        'monthly',
        new Date('2026-12-31T17:00:00.000Z'),
        new Date('2027-01-01T16:59:59.999Z'),
        'Asia/Jakarta',
      );
    } finally {
      jest.useRealTimers();
    }
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
    expect(workbook.getWorksheet('Ringkasan')?.getCell('J4').value).toBe(
      'Jumlah Transaksi',
    );
    expect(workbook.getWorksheet('Ringkasan')?.getCell('J4').isMerged).toBe(
      true,
    );
    for (const sheet of workbook.worksheets) {
      expect(sheet.getImages()).toHaveLength(0);
    }
    const xlsxZip = await JSZip.loadAsync(result.content as Buffer);
    const chartPaths = Object.keys(xlsxZip.files).filter((path) =>
      /^xl\/charts\/chart\d+\.xml$/.test(path),
    );
    expect(chartPaths).toHaveLength(8);
    const chartXml = await Promise.all(
      chartPaths.map(async (path) => {
        const file = xlsxZip.file(path);
        if (!file) throw new Error(`Missing chart component: ${path}`);
        return file.async('string');
      }),
    );
    expect(
      chartXml.filter((content) => content?.includes('<c:doughnutChart>')),
    ).toHaveLength(4);
    expect(
      chartXml.filter((content) => content?.includes('<c:barChart>')),
    ).toHaveLength(4);
    expect(
      chartXml.filter((content) => content?.includes('<c:lineChart>')),
    ).toHaveLength(1);
    const doughnutCenterShapes = await xlsxZip
      .file('xl/drawings/drawing5.xml')
      ?.async('string');
    expect(doughnutCenterShapes).toContain(
      'http://schemas.openxmlformats.org/drawingml/2006/chartDrawing',
    );
    expect(doughnutCenterShapes).toContain('TextBox 1');
    const summaryChart = await xlsxZip
      .file('xl/charts/chart1.xml')
      ?.async('string');
    const trendChart = await xlsxZip
      .file('xl/charts/chart4.xml')
      ?.async('string');
    const expenseSheetXml = await xlsxZip
      .file('xl/worksheets/sheet3.xml')
      ?.async('string');
    expect(summaryChart).toContain('<c:barChart>');
    expect(summaryChart).toContain('Pemasukan vs Pengeluaran');
    expect(summaryChart).toContain('&apos;Ringkasan&apos;!NeracaTrendIncome');
    expect(trendChart).toContain('<c:lineChart>');
    expect(trendChart).toContain('TrendData[Arus Kas Bersih]');
    expect(
      await xlsxZip.file('xl/worksheets/sheet1.xml')?.async('string'),
    ).toContain('<drawing r:id=');
    expect(expenseSheetXml).toMatch(
      /<pageSetup\b[^>]*\/><drawing r:id="rId2"\/><tableParts\b[\s\S]*?<\/tableParts><extLst\b/,
    );
    expect(expenseSheetXml).toMatch(
      /<c\b[^>]*\br="H6"[^>]*>[\s\S]*?<v>47000<\/v>/,
    );
    expect(
      await xlsxZip.file('xl/worksheets/sheet5.xml')?.async('string'),
    ).not.toContain('<drawing');
    const tableFiles = Object.keys(xlsxZip.files).filter((path) =>
      /^xl\/tables\/table\d+\.xml$/.test(path),
    );
    const transactionTableXml = (
      await Promise.all(
        tableFiles.map((path) => xlsxZip.file(path)?.async('string')),
      )
    ).find((xml) => xml?.includes('name="TransactionDetails"'));
    expect(transactionTableXml).toContain('ref="A1:K11"');
    expect(
      Object.keys(xlsxZip.files).filter((path) => path.startsWith('xl/media/')),
    ).toHaveLength(0);
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('A5').value,
    ).toMatchObject({
      formula: expect.stringContaining('SUMIFS'),
      result: 100_000,
    });
    expect(
      (
        workbook.getWorksheet('Ringkasan')?.getCell('A5').value as {
          formula: string;
        }
      ).formula,
    ).toContain('TransactionDetails[Jenis Data]');
    expect(
      (
        workbook.getWorksheet('Ringkasan')?.getCell('A5').value as {
          formula: string;
        }
      ).formula,
    ).toContain('TransactionDetails[Kunci Periode]');
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
      workbook.getWorksheet('Tren Arus Kas')?.getCell('B31').value,
    ).toMatchObject({
      formula: expect.stringContaining('SUMIFS'),
      result: 100_000,
    });
    expect(
      (
        workbook.getWorksheet('Tren Arus Kas')?.getCell('B31').value as {
          formula: string;
        }
      ).formula,
    ).toContain('TransactionDetails[Jenis Data]');
    expect(
      (
        workbook.getWorksheet('Tren Arus Kas')?.getCell('B31').value as {
          formula: string;
        }
      ).formula,
    ).toContain('TransactionDetails[Kunci Periode]');
    expect(
      workbook.getWorksheet('Pengeluaran per Kategori')?.getCell('I6').value,
    ).toMatchObject({
      formula: expect.stringContaining('IFERROR'),
      result: 1,
    });
    expect(
      workbook.getWorksheet('Pengeluaran per Kategori')?.getCell('G6').value,
    ).toBe('Makanan');
    expect(
      workbook.getWorksheet('Pengeluaran per Kategori')?.getCell('H48').value,
    ).toMatchObject({
      formula: expect.stringContaining('"Pembanding"'),
    });
    expect(
      workbook.getWorksheet('Pengeluaran per Kategori')?.getCell('I48').value,
    ).toMatchObject({
      formula: expect.stringContaining('"Laporan"'),
      result: 47_000,
    });
    expect(
      workbook.getWorksheet('Ringkasan')?.getCell('J11').value,
    ).toMatchObject({
      formula: expect.stringContaining("'Pengeluaran per Kategori'!G6"),
      result: 'Makanan',
    });
    expect(
      (
        workbook.getWorksheet('Pengeluaran per Kategori')?.getCell('H6')
          .value as { formula: string }
      ).formula,
    ).toContain('TransactionDetails[ID Kategori]');
    expect(
      (
        workbook.getWorksheet('Pengeluaran per Kategori')?.getCell('H6')
          .value as { formula: string }
      ).formula,
    ).toContain('TransactionDetails[Jenis Data]');
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
          ref: 'I6:I6',
          rules: expect.arrayContaining([
            expect.objectContaining({
              type: 'dataBar',
              color: { argb: expect.stringMatching(/B76A61$/) },
            }),
          ]),
        }),
      ]),
    );
    expect(workbook.getWorksheet('Rincian Transaksi')?.getTables().length).toBe(
      1,
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
      argb: expect.stringMatching(/65736F$/),
    });
    const transactionReferences = workbook
      .getWorksheet('Rincian Transaksi')
      ?.getColumn(1)
      .values.slice(2, 12);
    expect(transactionReferences).toHaveLength(10);
    expect(
      transactionReferences?.every(
        (reference) =>
          typeof reference === 'string' && /^\d{16}$/.test(reference),
      ),
    ).toBe(true);
    expect(new Set(transactionReferences).size).toBe(
      transactionReferences?.length,
    );
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.getColumn(1).numFmt,
    ).toBe('@');
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.getColumn(10).hidden,
    ).toBe(true);
    expect(
      workbook.getWorksheet('Rincian Transaksi')?.getColumn(11).hidden,
    ).toBe(true);
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
    expect(workbook.getWorksheet('Ringkasan')?.getCell('A8').value).toBe(
      'Belum ada transaksi pada periode laporan.',
    );
    expect(
      workbook.getWorksheet('Tren Arus Kas')?.getCell('B32').value,
    ).toMatchObject({
      formula: 'SUM(TrendData[Pemasukan])',
    });
    expect(workbook.getWorksheet('Tren Arus Kas')?.getImages()).toHaveLength(0);
    expect(
      workbook.getWorksheet('Pengeluaran per Kategori')?.getImages(),
    ).toHaveLength(0);
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
      note: `transaction ${index}`,
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
    const details = workbook.getWorksheet('Rincian Transaksi');
    expect(details?.getCell('A1002').value).toMatch(/^\d{16}$/);
    expect(details?.getCell('E1002').value).toBe('transaction 1000');
  });
});
