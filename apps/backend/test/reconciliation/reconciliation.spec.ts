import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { AnalyticsService } from '../../src/modules/analytics/services/analytics.service';
import type { AnalyticsRangeQuery } from '../../src/modules/analytics/services/analytics.service';
import { ForecastService } from '../../src/modules/ai/services/forecast.service';
import { PrismaService } from '../../src/database/prisma.service';
import { CashflowAnalyticsService } from '../../src/modules/dashboard/services/cashflow-analytics.service';
import { DashboardService } from '../../src/modules/dashboard/services/dashboard.service';
import { PrismaDashboardRepository } from '../../src/modules/dashboard/repositories/prisma-dashboard.repository';
import { BudgetAnalyticsService } from '../../src/modules/reports/services/budget-analytics.service';
import { CategoryBreakdownService } from '../../src/modules/reports/services/category-breakdown.service';
import { CashflowTrendService } from '../../src/modules/reports/services/cashflow-trend.service';
import { FinancialInsightsService } from '../../src/modules/reports/services/financial-insights.service';
import { MonthlyReportService } from '../../src/modules/reports/services/monthly-report.service';
import { ReportExportService } from '../../src/modules/reports/services/report-export.service';
import { ReportsController } from '../../src/modules/reports/controllers/reports.controller';
import { JwtAuthGuard } from '../../src/modules/auth/jwt-auth.guard';
import { DateHelper } from '../../src/common/utils/date.util';
import { cleanupReconciliation, seedReconciliation } from './seed';

const DAY_MS = 86_400_000;
const excelSerial = (date: Date) =>
  Math.floor(date.getTime() / DAY_MS) + 25_569;
const NativeDate = global.Date;
const SCENARIO_A_NOW = NativeDate.parse('2026-09-15T05:00:00.000Z');

function freezeSystemDate(timestamp: number): void {
  class FrozenDate extends NativeDate {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        super(timestamp);
      } else if (value instanceof NativeDate) {
        super(value.getTime());
      } else if (value === undefined) {
        super(Number.NaN);
      } else {
        super(value);
      }
    }

    static now(): number {
      return timestamp;
    }
  }

  global.Date = FrozenDate as DateConstructor;
}

function formulaDateBounds(formula: string): [number, number] {
  const serials = Array.from(
    formula.matchAll(/DATE\((\d+),(\d+),(\d+)\)/g),
    (match) =>
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) /
        DAY_MS +
      25_569,
  );
  if (serials.length !== 2) {
    throw new Error(`Expected two date bounds in formula: ${formula}`);
  }
  return [serials[0], serials[1]];
}

function getFormulaCache(xml: string, address: string): number {
  const cell = xml.match(
    new RegExp(`<c\\b[^>]*\\br="${address}"[^>]*>([\\s\\S]*?)</c>`),
  );
  const value = cell?.[1].match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (value === undefined) throw new Error(`Missing formula cache ${address}`);
  return Number(value);
}

function evaluateDateFormula(
  details: ExcelJS.Worksheet | undefined,
  formula: string,
  transactionType: string,
): number {
  const [lower, upper] = formulaDateBounds(formula);
  let total = 0;
  details?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const date = row.getCell(2).value;
    const amount = row.getCell(6).value;
    if (
      date instanceof Date &&
      typeof amount === 'number' &&
      row.getCell(10).value === transactionType &&
      row.getCell(11).value === 'Laporan' &&
      excelSerial(date) >= lower &&
      excelSerial(date) < upper
    ) {
      total += amount;
    }
  });
  return total;
}

describe('Local financial reconciliation 3A-3H', () => {
  const prisma = new PrismaService();
  const tracker = { ids: [] as string[] };
  let seeded: Awaited<ReturnType<typeof seedReconciliation>>;

  beforeAll(async () => {
    console.log(
      `RECONCILIATION_ENV TZ=${process.env.TZ ?? '(unset)'} offsetMinutes=${new Date().getTimezoneOffset()}`,
    );
    expect(process.env.TZ).toBe('UTC');
    expect(new Date().getTimezoneOffset()).toBe(0);
    freezeSystemDate(SCENARIO_A_NOW);
    console.log(`RECONCILIATION_FROZEN_NOW ${new Date().toISOString()}`);
    await prisma.$connect();
    try {
      seeded = await seedReconciliation(prisma, tracker);
    } catch (error) {
      console.error('RECONCILIATION_SEED_ERROR', error);
      throw error;
    }
  }, 120_000);

  afterAll(async () => {
    let counts: Record<string, number> = {};
    try {
      counts = await cleanupReconciliation(prisma, tracker.ids);
      console.log(`RECONCILIATION_CLEANUP ${JSON.stringify(counts)}`);
      expect(counts.remainingUsers).toBe(0);
      expect(counts.remainingTransactions).toBe(0);
      expect(counts.remainingCategories).toBe(0);
      expect(counts.remainingSettings).toBe(0);
    } finally {
      await prisma.$disconnect();
      global.Date = NativeDate;
    }
  }, 120_000);

  it('reconciles September summaries, range parsing, comparisons, forecast, and XLSX against the manual oracle', async () => {
    const userA = seeded.users.A;
    const userB = seeded.users.B;
    const userC = seeded.users.C;
    const monthly = new MonthlyReportService(prisma);
    const breakdown = new CategoryBreakdownService(prisma);
    const trend = new CashflowTrendService(prisma);
    const insights = new FinancialInsightsService(prisma);
    const analytics = new AnalyticsService(prisma, monthly, breakdown, trend);
    const exporter = new ReportExportService(monthly, breakdown, trend, prisma);
    const dashboardRepository = new PrismaDashboardRepository(prisma);
    const dashboardService = new DashboardService(prisma, dashboardRepository);
    const controller = new ReportsController(
      prisma,
      monthly,
      breakdown,
      trend,
      new BudgetAnalyticsService(prisma),
      exporter,
      insights,
    );
    const budgetFailure = new Error('local budget analysis failure');
    const failingBudgetRoute = new ReportsController(
      prisma,
      monthly,
      breakdown,
      trend,
      {
        analyzeMonth: jest.fn().mockRejectedValue(budgetFailure),
      } as unknown as BudgetAnalyticsService,
      exporter,
      insights,
    );
    await expect(
      failingBudgetRoute.getBudgetAnalysis(userA, {
        month: 9,
        year: 2026,
      }),
    ).rejects.toBe(budgetFailure);
    const septemberStart = DateHelper.startOfMonth(2026, 9);
    const septemberEnd = DateHelper.endOfMonth(2026, 9);
    const isoRange = {
      startDate: '2026-08-31T17:00:00.000Z',
      endDate: '2026-09-30T16:59:59.999Z',
    };
    const dateOnlyRange = {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    };

    const dashboardResult = await dashboardService.getSummaryForUser(userA);
    const dashboardSummary = await dashboardRepository.getSummary(
      userA,
      septemberStart,
      septemberEnd,
      'Asia/Jakarta',
    );
    expect(dashboardResult).toEqual(dashboardSummary);
    const monthlyA = await controller.getMonthly(userA, {
      month: 9,
      year: 2026,
    });
    const controllerTrendDateOnly = await controller.getCashflowTrend(userA, {
      type: 'daily',
      ...dateOnlyRange,
    });
    const controllerTrendIso = await controller.getCashflowTrend(userA, {
      type: 'daily',
      ...isoRange,
    });
    const trendAugust = await trend.getTrend(
      userA,
      'daily',
      DateHelper.startOfMonth(2026, 8),
      DateHelper.endOfMonth(2026, 8),
    );
    const incomeBreakdown = await controller.getCategoryBreakdown(userA, {
      type: 'income',
      ...dateOnlyRange,
    });
    const expenseBreakdown = await controller.getCategoryBreakdown(userA, {
      type: 'expense',
      ...dateOnlyRange,
    });

    expect(dashboardSummary.total_assets_cents).toBe('3720000');
    expect(dashboardSummary.total_income_cents).toBe('250000');
    expect(dashboardSummary.total_expense_cents).toBe('120000');
    expect(dashboardSummary.net_cash_flow_cents).toBe('130000');
    expect(monthlyA).toMatchObject({
      month: 9,
      year: 2026,
      summary: {
        income: '250000',
        expense: '120000',
        netCashFlow: '130000',
        transactions: 3,
      },
    });
    expect(controllerTrendDateOnly).toEqual(controllerTrendIso);
    expect(controllerTrendDateOnly.data).toEqual([
      {
        period: '2026-09-01',
        income: '250000',
        expense: '0',
        netCashFlow: '250000',
      },
      {
        period: '2026-09-07',
        income: '0',
        expense: '50000',
        netCashFlow: '-50000',
      },
      {
        period: '2026-09-20',
        income: '0',
        expense: '70000',
        netCashFlow: '-70000',
      },
    ]);
    expect(trendAugust.data).toContainEqual(
      expect.objectContaining({
        period: '2026-08-31',
        expense: '100000',
      }),
    );
    expect(incomeBreakdown.total).toBe('250000');
    expect(expenseBreakdown.total).toBe('120000');
    expect(
      controllerTrendDateOnly.data.reduce(
        (sum, point) => sum + BigInt(point.income) + BigInt(point.expense),
        0n,
      ),
    ).toBe(BigInt(incomeBreakdown.total) + BigInt(expenseBreakdown.total));

    const dashboardBalance = BigInt(dashboardSummary.total_assets_cents);
    expect(dashboardBalance).toBe(3_720_000n);
    const userASettings = await prisma.userSettings.findUniqueOrThrow({
      where: { user_id: userA },
    });
    expect(userASettings.timezone).toBe('Asia/Jakarta');

    const analyticsQuery: AnalyticsRangeQuery = {
      startDate: DateHelper.startOfCalendarMonthInTimezone(
        2026,
        9,
        'Asia/Jakarta',
      ),
      endDate: DateHelper.endOfCalendarMonthInTimezone(
        2026,
        9,
        'Asia/Jakarta',
      ),
      granularity: 'daily',
      timeZone: 'Asia/Jakarta',
    };
    const comparisonRows = [];
    for (const [label, userId] of [
      ['A', userA],
      ['B', userB],
      ['C', userC],
    ] as const) {
      const current = await monthly.getMonthlyReport(userId, 9, 2026);
      const previous = await monthly.getMonthlyReport(userId, 8, 2026);
      const cashflowAnalytics = await new CashflowAnalyticsService(
        prisma,
      ).getAnalytics(userId, septemberStart, septemberEnd);
      const analyticsOverview = await analytics.overview(
        userId,
        analyticsQuery,
      );
      const insightResult = await insights.getInsights(userId, 9, 2026);
      comparisonRows.push({
        user: label,
        current: current.summary,
        previous: previous.summary,
        cashflowAnalytics: cashflowAnalytics.comparison,
        analytics: analyticsOverview.comparison,
        insights: insightResult.summary,
      });
    }

    expect(comparisonRows[1].current.netCashFlow).toBe('200000');
    expect(comparisonRows[1].previous.netCashFlow).toBe('0');
    expect(comparisonRows[1].cashflowAnalytics.netCashFlow).toBeNull();
    expect(comparisonRows[1].analytics.netCashFlow).toBeNull();
    expect(comparisonRows[2].current.netCashFlow).toBe('300000');
    expect(comparisonRows[2].previous.netCashFlow).toBe('-200000');
    expect(comparisonRows[2].cashflowAnalytics.netCashFlow).toBe(250);
    expect(comparisonRows[2].analytics.netCashFlow).toBe(250);

    const forecastService = new ForecastService(prisma);
    forecastService.clock = () => new Date('2026-09-15T05:00:00.000Z');
    const forecastA = await forecastService.forecast(userA, { horizon: 1 });
    const openingA =
      BigInt(forecastA.months[0].projectedEndingBalanceCents) -
      BigInt(forecastA.months[0].projectedNetCashflowCents);
    expect(forecastA.months[0].period).toBe('2026-10');
    expect(openingA).toBe(3_630_000n);
    expect(forecastA.basis.monthsUsed).toBe(5);
    expect(forecastA.months[0].projectedNetCashflowCents).toBe('600000');
    expect(openingA - 3_500_000n).toBe(130_000n);
    expect(BigInt(dashboardSummary.total_assets_cents) - openingA).toBe(
      90_000n,
    );

    forecastService.clock = () => new Date('2026-08-31T18:00:00.000Z');
    const forecastB = await forecastService.forecast(userA, { horizon: 1 });
    const openingB =
      BigInt(forecastB.months[0].projectedEndingBalanceCents) -
      BigInt(forecastB.months[0].projectedNetCashflowCents);
    expect(forecastB.months[0].period).toBe('2026-10');
    expect(openingB).toBe(3_630_000n);
    expect(forecastB.basis.monthsUsed).toBe(5);
    expect(forecastB.months[0].projectedNetCashflowCents).toBe('600000');
    expect(openingB - 3_500_000n).toBe(130_000n);

    const xlsx = await exporter.export({
      type: 'monthly',
      format: 'xlsx',
      startDate: septemberStart,
      endDate: septemberEnd,
      userId: userA,
    });
    expect(Buffer.isBuffer(xlsx.content)).toBe(true);
    if (!Buffer.isBuffer(xlsx.content)) throw new Error('Expected XLSX buffer');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.content);
    const zip = await JSZip.loadAsync(xlsx.content);
    const trendXml = await zip
      .file('xl/worksheets/sheet2.xml')
      ?.async('string');
    if (!trendXml) throw new Error('Missing trend sheet XML');
    const details = workbook.getWorksheet('Rincian Transaksi');
    const trendSheet = workbook.getWorksheet('Tren Arus Kas');
    const summary = workbook.getWorksheet('Ringkasan');
    expect(details).toBeDefined();
    expect(trendSheet).toBeDefined();
    expect(summary).toBeDefined();

    const detailDates = [2, 3, 4, 5, 6, 7].map((row) => {
      const value = details?.getCell(row, 2).value;
      return value instanceof Date ? value.toISOString().slice(0, 10) : value;
    });
    expect(detailDates).toEqual([
      '2026-09-01',
      '2026-09-07',
      '2026-09-20',
      '2026-08-15',
      '2026-08-16',
      '2026-08-31',
    ]);
    expect(summary?.getCell('A2').value).toContain('01 September 2026');
    expect(summary?.getCell('A2').value).toContain('30 September 2026');
    expect(summary?.getCell('A5').value).toMatchObject({ result: 250_000 });
    expect(summary?.getCell('D5').value).toMatchObject({ result: 120_000 });
    expect(summary?.getCell('G5').value).toMatchObject({ result: 130_000 });
    expect(summary?.getCell('A7').value).toMatchObject({ result: '-75.0%' });
    expect(summary?.getCell('D7').value).toMatchObject({ result: '-76.0%' });
    expect(summary?.getCell('G7').value).toMatchObject({ result: '-74.0%' });

    const trendRows: Array<{
      period: string;
      income: number;
      expense: number;
    }> = [];
    trendSheet?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const period = row.getCell(1).value;
      const income = row.getCell(2).value;
      const expense = row.getCell(3).value;
      if (
        typeof period === 'string' &&
        period !== 'Total' &&
        typeof income === 'object' &&
        income !== null &&
        'formula' in income &&
        typeof expense === 'object' &&
        expense !== null &&
        'formula' in expense
      ) {
        trendRows.push({
          period,
          income: getFormulaCache(trendXml, `B${rowNumber}`),
          expense: getFormulaCache(trendXml, `C${rowNumber}`),
        });
      }
    });
    expect(trendRows).toEqual([
      { period: '2026-09-01', income: 250_000, expense: 0 },
      { period: '2026-09-07', income: 0, expense: 50_000 },
      { period: '2026-09-20', income: 0, expense: 70_000 },
    ]);

    const recalculated = trendRows.map((point, index) => {
      const row = index + 2;
      const formula = trendSheet?.getCell(row, 2).value;
      if (
        typeof formula !== 'object' ||
        formula === null ||
        !('formula' in formula)
      ) {
        throw new Error(`Missing formula at row ${row}`);
      }
      const [lower, upper] = formulaDateBounds(String(formula.formula));
      const sumColumn = (column: number, transactionType: string) => {
        let total = 0;
        details?.eachRow((detail, detailRow) => {
          if (detailRow === 1) return;
          const date = detail.getCell(2).value;
          const amount = detail.getCell(6).value;
          const type = detail.getCell(10).value;
          const period = detail.getCell(11).value;
          if (
            date instanceof Date &&
            typeof amount === 'number' &&
            type === transactionType &&
            period === 'Laporan' &&
            excelSerial(date) >= lower &&
            excelSerial(date) < upper
          ) {
            total += amount;
          }
        });
        return (
          getFormulaCache(
            trendXml,
            `${String.fromCharCode(64 + column)}${row}`,
          ) === total
        );
      };
      return {
        period: point.period,
        incomeMatches: sumColumn(2, 'INCOME'),
        expenseMatches: sumColumn(3, 'EXPENSE'),
      };
    });
    expect(recalculated).toEqual([
      { period: '2026-09-01', incomeMatches: true, expenseMatches: true },
      { period: '2026-09-07', incomeMatches: true, expenseMatches: true },
      { period: '2026-09-20', incomeMatches: true, expenseMatches: true },
    ]);

    const grainCases = [
      {
        type: 'weekly' as const,
        startDate: DateHelper.startOfMonth(2026, 8),
        endDate: septemberEnd,
        expected: [
          ['2026-W36', 250_000, 100_000],
          ['2026-W37', 0, 50_000],
          ['2026-W38', 0, 70_000],
        ],
      },
      {
        type: 'monthly' as const,
        startDate: DateHelper.startOfMonth(2026, 1),
        endDate: DateHelper.endOfMonth(2026, 12),
        expected: [
          ['2026-08', 1_000_000, 500_000],
          ['2026-09', 250_000, 120_000],
          ['2026-10', 90_000, 0],
        ],
      },
    ];

    for (const grainCase of grainCases) {
      const grainExport = await exporter.export({
        type: 'monthly',
        format: 'xlsx',
        startDate: grainCase.startDate,
        endDate: grainCase.endDate,
        userId: userA,
      });
      if (!Buffer.isBuffer(grainExport.content)) {
        throw new Error(`Expected ${grainCase.type} XLSX buffer`);
      }
      const grainWorkbook = new ExcelJS.Workbook();
      await grainWorkbook.xlsx.load(grainExport.content);
      const grainZip = await JSZip.loadAsync(grainExport.content);
      const grainXml = await grainZip
        .file('xl/worksheets/sheet2.xml')
        ?.async('string');
      if (!grainXml) throw new Error(`Missing ${grainCase.type} trend XML`);
      const grainDetails = grainWorkbook.getWorksheet('Rincian Transaksi');
      const grainSheet = grainWorkbook.getWorksheet('Tren Arus Kas');
      const serviceTrend = await trend.getTrend(
        userA,
        grainCase.type,
        grainCase.startDate,
        grainCase.endDate,
      );
      const measured: Array<[string, number, number]> = [];
      grainSheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const period = row.getCell(1).value;
        if (
          typeof period === 'string' &&
          grainCase.expected.some(
            ([expectedPeriod]) => expectedPeriod === period,
          )
        ) {
          measured.push([
            period,
            getFormulaCache(grainXml, `B${rowNumber}`),
            getFormulaCache(grainXml, `C${rowNumber}`),
          ]);
          const incomeFormula = row.getCell(2).value;
          const expenseFormula = row.getCell(3).value;
          if (
            typeof incomeFormula !== 'object' ||
            incomeFormula === null ||
            !('formula' in incomeFormula) ||
            typeof expenseFormula !== 'object' ||
            expenseFormula === null ||
            !('formula' in expenseFormula)
          ) {
            throw new Error(`Missing ${grainCase.type} formula for ${period}`);
          }
          expect(getFormulaCache(grainXml, `B${rowNumber}`)).toBe(
            evaluateDateFormula(
              grainDetails,
              String(incomeFormula.formula),
              'INCOME',
            ),
          );
          expect(getFormulaCache(grainXml, `C${rowNumber}`)).toBe(
            evaluateDateFormula(
              grainDetails,
              String(expenseFormula.formula),
              'EXPENSE',
            ),
          );
        }
      });
      expect(measured).toEqual(grainCase.expected);
      expect(
        serviceTrend.data
          .filter(({ period }) =>
            grainCase.expected.some(
              ([expectedPeriod]) => expectedPeriod === period,
            ),
          )
          .map(({ period, income, expense }) => [
            period,
            Number(income),
            Number(expense),
          ]),
      ).toEqual(grainCase.expected);
    }

    console.log(
      `RECONCILIATION_VALUES ${JSON.stringify({
        dashboard: dashboardSummary,
        monthly: monthlyA,
        trend: controllerTrendDateOnly,
        categories: {
          income: incomeBreakdown.total,
          expense: expenseBreakdown.total,
        },
        comparisons: comparisonRows,
        forecast: {
          scenarioA: {
            period: forecastA.months[0].period,
            opening: openingA.toString(),
          },
          scenarioB: {
            period: forecastB.months[0].period,
            opening: openingB.toString(),
          },
        },
        workbook: {
          detailDates,
          trendRows,
          summaryLabel: summary?.getCell('A2').value,
          formulaCacheMatches: recalculated,
          additionalGranularities: grainCases.map(({ type, expected }) => ({
            type,
            expected,
          })),
        },
      })}`,
    );
  }, 120_000);

  it('reconciles Makassar and Jayapura month-boundary oracles across reporting paths', async () => {
    const monthly = new MonthlyReportService(prisma);
    const breakdown = new CategoryBreakdownService(prisma);
    const trend = new CashflowTrendService(prisma);
    const insights = new FinancialInsightsService(prisma);
    const analytics = new AnalyticsService(prisma, monthly, breakdown, trend);
    const exporter = new ReportExportService(monthly, breakdown, trend, prisma);
    const controller = new ReportsController(
      prisma,
      monthly,
      breakdown,
      trend,
      new BudgetAnalyticsService(prisma),
      exporter,
      insights,
    );
    const cases = [
      {
        label: 'Makassar',
        key: 'M' as const,
        timezone: 'Asia/Makassar',
        isoStart: '2026-08-31T16:00:00.000Z',
        isoEnd: '2026-09-30T15:59:59.999Z',
        oracle: {
          augustIncome: '10000',
          augustExpense: '1000',
          septemberIncome: '20000',
          septemberExpense: '2000',
          balance: '27000',
          comparison: 100,
        },
      },
      {
        label: 'Jayapura',
        key: 'J' as const,
        timezone: 'Asia/Jayapura',
        isoStart: '2026-08-31T15:00:00.000Z',
        isoEnd: '2026-09-30T14:59:59.999Z',
        oracle: {
          augustIncome: '30000',
          augustExpense: '3000',
          septemberIncome: '40000',
          septemberExpense: '4000',
          balance: '63000',
          comparison: 33.33,
        },
      },
    ] as const;
    const reconciliationRows = [];

    for (const item of cases) {
      const userId = seeded.users[item.key];
      const settings = await prisma.userSettings.findUniqueOrThrow({
        where: { user_id: userId },
      });
      expect(settings.timezone).toBe(item.timezone);

      const dashboard = await new DashboardService(
        prisma,
        new PrismaDashboardRepository(prisma),
      ).getSummaryForUser(userId);
      const current = await monthly.getMonthlyReport(userId, 9, 2026);
      const previous = await monthly.getMonthlyReport(userId, 8, 2026);
      const dateOnlyTrend = await controller.getCashflowTrend(userId, {
        type: 'daily',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });
      const isoTrend = await controller.getCashflowTrend(userId, {
        type: 'daily',
        startDate: item.isoStart,
        endDate: item.isoEnd,
      });
      const incomeBreakdown = await controller.getCategoryBreakdown(userId, {
        type: 'income',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });
      const expenseBreakdown = await controller.getCategoryBreakdown(userId, {
        type: 'expense',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });
      const cashflowAnalytics = await new CashflowAnalyticsService(
        prisma,
      ).getAnalytics(userId, '2026-09-01', '2026-09-30');
      const analyticsOverview = await analytics.overview(userId, {
        startDate: DateHelper.startOfCalendarMonthInTimezone(
          2026,
          9,
          item.timezone,
        ),
        endDate: DateHelper.endOfCalendarMonthInTimezone(
          2026,
          9,
          item.timezone,
        ),
        granularity: 'daily',
        timeZone: item.timezone,
      });
      const analyticsCashflow = await analytics.cashflow(userId, {
        startDate: DateHelper.startOfCalendarMonthInTimezone(
          2026,
          9,
          item.timezone,
        ),
        endDate: DateHelper.endOfCalendarMonthInTimezone(
          2026,
          9,
          item.timezone,
        ),
        granularity: 'daily',
        timeZone: item.timezone,
      });
      const insightResult = await insights.getInsights(userId, 9, 2026);
      const report = await exporter.export({
        type: 'monthly',
        format: 'xlsx',
        startDate: DateHelper.startOfCalendarMonthInTimezone(
          2026,
          9,
          item.timezone,
        ),
        endDate: DateHelper.endOfCalendarMonthInTimezone(
          2026,
          9,
          item.timezone,
        ),
        userId,
      });

      expect(dashboard.total_assets_cents).toBe(item.oracle.balance);
      expect(current.summary).toMatchObject({
        income: item.oracle.septemberIncome,
        expense: item.oracle.septemberExpense,
        netCashFlow: String(
          Number(item.oracle.septemberIncome) -
            Number(item.oracle.septemberExpense),
        ),
      });
      expect(previous.summary).toMatchObject({
        income: item.oracle.augustIncome,
        expense: item.oracle.augustExpense,
      });
      expect(dateOnlyTrend).toEqual(isoTrend);
      expect(dateOnlyTrend.data).toEqual([
        {
          period: '2026-09-01',
          income: item.oracle.septemberIncome,
          expense: item.oracle.septemberExpense,
          netCashFlow: String(
            Number(item.oracle.septemberIncome) -
              Number(item.oracle.septemberExpense),
          ),
        },
      ]);
      expect(incomeBreakdown.total).toBe(item.oracle.septemberIncome);
      expect(expenseBreakdown.total).toBe(item.oracle.septemberExpense);
      expect(cashflowAnalytics).toMatchObject({
        income: item.oracle.septemberIncome,
        expense: item.oracle.septemberExpense,
        netCashFlow: String(
          Number(item.oracle.septemberIncome) -
            Number(item.oracle.septemberExpense),
        ),
        comparison: {
          income: item.oracle.comparison,
          expense: item.oracle.comparison,
          netCashFlow: item.oracle.comparison,
        },
      });
      expect(analyticsOverview.comparison).toMatchObject({
        income: item.oracle.comparison,
        expense: item.oracle.comparison,
        netCashFlow: item.oracle.comparison,
      });
      expect(analyticsCashflow).toMatchObject({
        totalIncome: item.oracle.septemberIncome,
        totalExpense: item.oracle.septemberExpense,
        netCashFlow: String(
          Number(item.oracle.septemberIncome) -
            Number(item.oracle.septemberExpense),
        ),
        trend: dateOnlyTrend.data,
      });
      expect(insightResult.summary).toContain(
        `Your income increased by ${item.oracle.comparison}% compared to last month.`,
      );
      expect(insightResult.summary).toContain(
        `Your expenses increased by ${item.oracle.comparison}% compared to last month.`,
      );

      if (!Buffer.isBuffer(report.content)) {
        throw new Error('Expected XLSX buffer for timezone reconciliation');
      }
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(report.content);
      const zip = await JSZip.loadAsync(report.content);
      const trendXml = await zip
        .file('xl/worksheets/sheet2.xml')
        ?.async('string');
      if (!trendXml) throw new Error('Missing timezone trend worksheet XML');
      const details = workbook.getWorksheet('Rincian Transaksi');
      const trendSheet = workbook.getWorksheet('Tren Arus Kas');
      const summary = workbook.getWorksheet('Ringkasan');
      const workbookDetailDates: string[] = [];
      details?.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const date = row.getCell(2).value;
        if (date instanceof Date) {
          workbookDetailDates.push(date.toISOString().slice(0, 10));
        }
      });
      expect(workbookDetailDates.sort()).toEqual([
        '2026-08-01',
        '2026-08-31',
        '2026-09-01',
        '2026-09-01',
      ]);
      expect(summary?.getCell('A2').value).toContain('01 September 2026');
      expect(summary?.getCell('A5').value).toMatchObject({
        result: Number(item.oracle.septemberIncome),
      });
      expect(summary?.getCell('D5').value).toMatchObject({
        result: Number(item.oracle.septemberExpense),
      });
      expect(trendSheet?.getCell(2, 1).value).toBe('2026-09-01');
      expect(getFormulaCache(trendXml, 'B2')).toBe(
        Number(item.oracle.septemberIncome),
      );
      expect(getFormulaCache(trendXml, 'C2')).toBe(
        Number(item.oracle.septemberExpense),
      );
      const incomeFormula = trendSheet?.getCell(2, 2).value;
      const expenseFormula = trendSheet?.getCell(2, 3).value;
      if (
        typeof incomeFormula !== 'object' ||
        incomeFormula === null ||
        !('formula' in incomeFormula) ||
        typeof expenseFormula !== 'object' ||
        expenseFormula === null ||
        !('formula' in expenseFormula)
      ) {
        throw new Error('Missing trend formulas for timezone reconciliation');
      }
      expect(getFormulaCache(trendXml, 'B2')).toBe(
        evaluateDateFormula(details, String(incomeFormula.formula), 'INCOME'),
      );
      expect(getFormulaCache(trendXml, 'C2')).toBe(
        evaluateDateFormula(details, String(expenseFormula.formula), 'EXPENSE'),
      );

      reconciliationRows.push({
        zone: item.timezone,
        oracle: item.oracle,
        measured: {
          dashboard: dashboard.total_assets_cents,
          monthly: current.summary,
          previous: previous.summary,
          trend: dateOnlyTrend.data,
          category: {
            income: incomeBreakdown.total,
            expense: expenseBreakdown.total,
          },
          cashflowAnalytics,
          analyticsComparison: analyticsOverview.comparison,
          analyticsCashflow,
          insights: insightResult.summary,
          xlsx: {
            period: summary?.getCell('A2').value,
            income: getFormulaCache(trendXml, 'B2'),
            expense: getFormulaCache(trendXml, 'C2'),
          },
        },
      });
    }

    console.log(
      `RECONCILIATION_ZONE_ORACLE ${JSON.stringify(reconciliationRows)}`,
    );
  }, 120_000);

  it('returns an HTTP error, not a successful zero payload, when budget analysis fails', async () => {
    const failure = new Error('budget-analysis failure');
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: PrismaService,
          useValue: { userSettings: { findUnique: jest.fn() } },
        },
        { provide: MonthlyReportService, useValue: {} },
        { provide: CategoryBreakdownService, useValue: {} },
        { provide: CashflowTrendService, useValue: {} },
        {
          provide: BudgetAnalyticsService,
          useValue: { analyzeMonth: jest.fn().mockRejectedValue(failure) },
        },
        { provide: ReportExportService, useValue: {} },
        { provide: FinancialInsightsService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    try {
      await request(app.getHttpServer() as Server)
        .get('/reports/budget-analysis?month=9&year=2026')
        .expect(500);
    } finally {
      await app.close();
    }
  });
});
