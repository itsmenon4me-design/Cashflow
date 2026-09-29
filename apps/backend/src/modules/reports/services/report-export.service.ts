import { BadRequestException, Injectable } from '@nestjs/common';
import { TransactionType } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { DateHelper } from '../../../common/utils/date.util';
import { resolveUserTimezone } from '../../../common/utils/user-timezone.util';
import { CategoryBreakdownService } from './category-breakdown.service';
import { CashflowTrendService, type TrendType } from './cashflow-trend.service';
import { MonthlyReportService } from './monthly-report.service';
import {
  buildReportWorkbook,
  type ReportWorkbookInput,
  type WorkbookTransaction,
} from './report-workbook.builder';

type ExportType = 'monthly' | 'category' | 'trend';
type ExportFormat = 'csv' | 'xlsx';
type ReportRange = { start: Date; end: Date };

const MAX_EXCEL_NUMBER = 999_999_999_999_999n;
const MAX_EXCEL_ROWS = 1_048_576;
const DATABASE_PAGE_SIZE = 1_000;
const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExportResult {
  filename: string;
  contentType: string;
  content: Buffer | string;
}

@Injectable()
export class ReportExportService {
  constructor(
    private readonly monthlySvc: MonthlyReportService,
    private readonly categorySvc: CategoryBreakdownService,
    private readonly trendSvc: CashflowTrendService,
    private readonly prisma: PrismaService,
  ) {}

  private toCSV(rows: string[][]): string {
    const escape = (value: string) => {
      const text = String(value ?? '');
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return `\uFEFF${rows.map((columns) => columns.map(escape).join(',')).join('\r\n')}`;
  }

  private protectSpreadsheetText(value: string | null): string {
    const text = value ?? '';
    return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
  }

  private formatFileDate(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((value) => value.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private formatFileMonth(date: Date, timeZone: string): string {
    return this.formatFileDate(date, timeZone).slice(0, 7);
  }

  private resolveRange(
    type: ExportType,
    timeZone: string,
    params: {
      month?: number;
      year?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): ReportRange {
    const { month, year, startDate, endDate } = params;
    if (startDate || endDate) {
      if (!startDate || !endDate) {
        throw new BadRequestException(
          'Both startDate and endDate are required for a date range',
        );
      }
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime()) ||
        startDate.getTime() > endDate.getTime()
      ) {
        throw new BadRequestException('Invalid report date range');
      }
      return { start: startDate, end: endDate };
    }

    if (month !== undefined || year !== undefined) {
      if (
        month === undefined ||
        year === undefined ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12 ||
        !Number.isInteger(year) ||
        year < 1970 ||
        year > 3000
      ) {
        throw new BadRequestException('A valid month and year are required');
      }
      return {
        start: DateHelper.startOfCalendarMonthInTimezone(
          year,
          month,
          timeZone,
        ),
        end: DateHelper.endOfCalendarMonthInTimezone(year, month, timeZone),
      };
    }

    const now = new Date();
    if (type === 'trend') {
      const currentYear = DateHelper.yearInNamedTimezone(now, timeZone);
      return {
        start: DateHelper.startOfCalendarMonthInTimezone(
          currentYear,
          1,
          timeZone,
        ),
        end: DateHelper.endOfDayInTimezone(now, timeZone),
      };
    }
    const currentMonth = DateHelper.monthInNamedTimezone(now, timeZone);
    const currentYear = DateHelper.yearInNamedTimezone(now, timeZone);
    return {
      start: DateHelper.startOfCalendarMonthInTimezone(
        currentYear,
        currentMonth,
        timeZone,
      ),
      end: DateHelper.endOfCalendarMonthInTimezone(
        currentYear,
        currentMonth,
        timeZone,
      ),
    };
  }

  private getTrendType(range: ReportRange): TrendType {
    const days =
      Math.floor((range.end.getTime() - range.start.getTime()) / 86_400_000) +
      1;
    if (days <= 45) return 'daily';
    if (days <= 200) return 'weekly';
    return 'monthly';
  }

  private transactionWhere(userId: string, range: ReportRange) {
    return {
      user_id: userId,
      deleted_at: null,
      transaction_date: { gte: range.start, lte: range.end },
    };
  }

  private async getTransactions(
    userId: string,
    range: ReportRange,
    period: WorkbookTransaction['period'],
  ): Promise<WorkbookTransaction[]> {
    const where = this.transactionWhere(userId, range);
    const result: WorkbookTransaction[] = [];
    let cursor: string | undefined;

    while (true) {
      const rows = await this.prisma.transaction.findMany({
        where,
        select: {
          id: true,
          transaction_date: true,
          transaction_type: true,
          amount_cents: true,
          category_id: true,
          note: true,
          category: { select: { name: true } },
        },
        orderBy: [{ transaction_date: 'asc' }, { id: 'asc' }],
        take: DATABASE_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      result.push(
        ...rows.map((row): WorkbookTransaction => ({
          id: row.id,
          transactionDate: row.transaction_date,
          type:
            row.transaction_type === TransactionType.INCOME
              ? 'INCOME'
              : 'EXPENSE',
          amount: row.amount_cents,
          categoryId: row.category_id,
          categoryName: row.category.name ?? 'Tanpa kategori',
          note: row.note ?? '',
          period,
        })),
      );
      if (rows.length < DATABASE_PAGE_SIZE) break;
      const lastRow = rows.at(-1);
      if (!lastRow) {
        throw new Error('Transaction pagination returned an empty full page');
      }
      cursor = lastRow.id;
    }

    return result;
  }

  private assertExcelPrecision(transactions: WorkbookTransaction[]): void {
    const totals = new Map<string, bigint>();
    for (const transaction of transactions) {
      const amount =
        transaction.amount < 0n ? -transaction.amount : transaction.amount;
      if (amount > MAX_EXCEL_NUMBER) {
        throw new BadRequestException(
          'A transaction amount exceeds Excel numeric precision. Export the report as CSV instead.',
        );
      }
      const key = `${transaction.period}:${transaction.type}`;
      totals.set(key, (totals.get(key) ?? 0n) + transaction.amount);
    }
    for (const period of ['Laporan', 'Pembanding'] as const) {
      const income = totals.get(`${period}:INCOME`) ?? 0n;
      const expense = totals.get(`${period}:EXPENSE`) ?? 0n;
      const net = income - expense;
      const exceedsLimit = [income, expense, net].some(
        (value) => (value < 0n ? -value : value) > MAX_EXCEL_NUMBER,
      );
      if (exceedsLimit) {
        throw new BadRequestException(
          'A report total exceeds Excel numeric precision. Export the report as CSV instead.',
        );
      }
    }
  }

  private async exportWorkbook(
    userId: string,
    range: ReportRange,
    timeZone: string,
  ): Promise<ExportResult> {
    const { start: previousStart, end: previousEnd } =
      DateHelper.previousPeriodInTimezone(
        range.start,
        range.end,
        timeZone,
    );
    const previousRange = { start: previousStart, end: previousEnd };
    const trendType = this.getTrendType(range);
    const currentWhere = this.transactionWhere(userId, range);
    const comparisonWhere = this.transactionWhere(userId, previousRange);
    const [currentCount, comparisonCount] = await Promise.all([
      this.prisma.transaction.count({ where: currentWhere }),
      this.prisma.transaction.count({ where: comparisonWhere }),
    ]);
    if (currentCount + comparisonCount + 1 > MAX_EXCEL_ROWS) {
      throw new BadRequestException(
        "This report exceeds Excel's worksheet row limit. Narrow the date range or export as CSV.",
      );
    }

    const [currentRows, comparisonRows, trend] = await Promise.all([
      this.getTransactions(userId, range, 'Laporan'),
      this.getTransactions(userId, previousRange, 'Pembanding'),
      this.trendSvc.getTrend(userId, trendType, range.start, range.end),
    ]);
    if (currentRows.length + comparisonRows.length + 1 > MAX_EXCEL_ROWS) {
      throw new BadRequestException(
        "This report exceeds Excel's worksheet row limit. Narrow the date range or export as CSV.",
      );
    }

    const transactions = [...currentRows, ...comparisonRows];
    this.assertExcelPrecision(transactions);
    const generatedAt = new Date();
    const workbookInput: ReportWorkbookInput = {
      startDate: range.start,
      endDate: range.end,
      previousStartDate: previousStart,
      previousEndDate: previousEnd,
      generatedAt,
      transactions,
      trendType,
      trend: trend.data,
      timeZone,
    };
    const content = await buildReportWorkbook(workbookInput);
    return {
      filename: `laporan-keuangan-${this.formatFileDate(range.start, timeZone)}-sampai-${this.formatFileDate(range.end, timeZone)}.xlsx`,
      contentType: XLSX_CONTENT_TYPE,
      content,
    };
  }

  async export(params: {
    type: ExportType;
    format: ExportFormat;
    month?: number;
    year?: number;
    startDate?: Date;
    endDate?: Date;
    userId: string;
  }): Promise<ExportResult> {
    const { type, format, month, year, startDate, endDate, userId } = params;
    if (!['monthly', 'category', 'trend'].includes(type)) {
      throw new BadRequestException('Invalid type');
    }
    if (format !== 'csv' && format !== 'xlsx') {
      throw new BadRequestException('Invalid format');
    }
    if (format === 'xlsx' && type !== 'monthly') {
      throw new BadRequestException(
        'The styled XLSX workbook is available for the complete monthly report',
      );
    }

    const timeZone = await resolveUserTimezone(this.prisma, userId);
    const range = this.resolveRange(type, timeZone, {
      month,
      year,
      startDate,
      endDate,
    });
    if (format === 'xlsx')
      return this.exportWorkbook(userId, range, timeZone);

    if (type === 'monthly') {
      const report = await this.monthlySvc.getMonthlyReport(
        userId,
        undefined,
        undefined,
        range,
      );
      if (startDate === undefined && endDate === undefined) {
        const month = this.formatFileMonth(range.start, timeZone);
        const [year, monthNumber] = month.split('-');
        return {
          filename: `monthly-report-${year}-${monthNumber}.csv`,
          contentType: 'text/csv; charset=utf-8',
          content: this.toCSV([
            [
              'month',
              'year',
              'income',
              'expense',
              'netCashFlow',
              'transactions',
            ],
            [
              monthNumber,
              year,
              report.summary.income,
              report.summary.expense,
              report.summary.netCashFlow,
              String(report.summary.transactions),
            ],
          ]),
        };
      }
      const rows = [
        [
          'periodStart',
          'periodEnd',
          'income',
          'expense',
          'netCashFlow',
          'transactions',
        ],
        [
          this.formatFileDate(range.start, timeZone),
          this.formatFileDate(range.end, timeZone),
          report.summary.income,
          report.summary.expense,
          report.summary.netCashFlow,
          String(report.summary.transactions),
        ],
      ];
      return {
        filename: `laporan-keuangan-${this.formatFileDate(range.start, timeZone)}-sampai-${this.formatFileDate(range.end, timeZone)}.csv`,
        contentType: 'text/csv; charset=utf-8',
        content: this.toCSV(rows),
      };
    }

    if (type === 'category') {
      const breakdown = await this.categorySvc.getBreakdown(
        userId,
        'expense',
        undefined,
        undefined,
        range,
      );
      if (startDate === undefined && endDate === undefined) {
        const month = this.formatFileMonth(range.start, timeZone);
        return {
          filename: `category-breakdown-${month}.csv`,
          contentType: 'text/csv; charset=utf-8',
          content: this.toCSV([
            [
              'categoryId',
              'categoryName',
              'totalAmount',
              'percentage',
              'transactionCount',
            ],
            ...(breakdown.categories ?? []).map((category) => [
              category.categoryId,
              this.protectSpreadsheetText(category.categoryName),
              String(category.totalAmount),
              String(category.percentage),
              String(category.transactionCount ?? 0),
            ]),
          ]),
        };
      }
      const rows = [
        [
          'categoryId',
          'categoryName',
          'totalAmount',
          'percentage',
          'transactionCount',
        ],
        ...(breakdown.categories ?? []).map((category) => [
          category.categoryId,
          this.protectSpreadsheetText(category.categoryName),
          String(category.totalAmount),
          String(category.percentage),
          String(category.transactionCount ?? 0),
        ]),
      ];
      return {
        filename: `category-breakdown-${this.formatFileDate(range.start, timeZone)}-sampai-${this.formatFileDate(range.end, timeZone)}.csv`,
        contentType: 'text/csv; charset=utf-8',
        content: this.toCSV(rows),
      };
    }

    const trend = await this.trendSvc.getTrend(
      userId,
      'monthly',
      range.start,
      range.end,
    );
    const rows = [
      ['period', 'income', 'expense', 'netCashFlow'],
      ...(trend.data ?? []).map((point) => [
        point.period,
        point.income,
        point.expense,
        point.netCashFlow,
      ]),
    ];
    const trendFilename =
      startDate === undefined && endDate === undefined
        ? 'cashflow-trend.csv'
        : `cashflow-trend-${this.formatFileDate(range.start, timeZone)}-sampai-${this.formatFileDate(range.end, timeZone)}.csv`;
    return {
      filename: trendFilename,
      contentType: 'text/csv; charset=utf-8',
      content: this.toCSV(rows),
    };
  }
}
