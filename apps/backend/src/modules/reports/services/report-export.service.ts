import { Injectable, BadRequestException } from '@nestjs/common';
import { MonthlyReportService } from './monthly-report.service';
import { CategoryBreakdownService } from './category-breakdown.service';
import { CashflowTrendService } from './cashflow-trend.service';

type ExportType = 'monthly' | 'category' | 'trend';
type ExportFormat = 'json' | 'csv';

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
  ) {}

  private padMonth(month: number) {
    return String(month).padStart(2, '0');
  }

  private toCSV(rows: string[][]): string {
    // rows: array of columns; produce CSV with UTF-8 BOM to ensure UTF-8 in Excel
    const escape = (v: string) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (
        s.includes('"') ||
        s.includes(',') ||
        s.includes('\n') ||
        s.includes('\r')
      ) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = rows.map((cols) => cols.map(escape).join(','));
    // UTF-8 BOM
    return '\uFEFF' + lines.join('\r\n');
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
    if (!['monthly', 'category', 'trend'].includes(type))
      throw new BadRequestException('Invalid type');
    if (!['json', 'csv'].includes(format))
      throw new BadRequestException('Invalid format');

    if (type === 'monthly') {
      const m = month ?? new Date().getMonth() + 1;
      const y = year ?? new Date().getFullYear();
      const report = await this.monthlySvc.getMonthlyReport(userId, m, y);
      if (format === 'json') {
        const filename = `monthly-report-${y}-${this.padMonth(m)}.json`;
        return {
          filename,
          contentType: 'application/json; charset=utf-8',
          content: JSON.stringify(report),
        };
      }
      // CSV: single-row summary
      const filename = `monthly-report-${y}-${this.padMonth(m)}.csv`;
      const headers = [
        'month',
        'year',
        'income',
        'expense',
        'netCashFlow',
        'transactions',
      ];
      const row = [
        String(report.month),
        String(report.year),
        String(report.summary.income),
        String(report.summary.expense),
        String(report.summary.netCashFlow),
        String(report.summary.transactions),
      ];
      const csv = this.toCSV([headers, row]);
      return { filename, contentType: 'text/csv; charset=utf-8', content: csv };
    }

    if (type === 'category') {
      const m = month ?? new Date().getMonth() + 1;
      const y = year ?? new Date().getFullYear();
      const breakdown = await this.categorySvc.getBreakdown(
        userId,
        'expense',
        m,
        y,
      );
      if (format === 'json') {
        const filename = `category-breakdown-${y}-${this.padMonth(m)}.json`;
        return {
          filename,
          contentType: 'application/json; charset=utf-8',
          content: JSON.stringify(breakdown),
        };
      }
      const filename = `category-breakdown-${y}-${this.padMonth(m)}.csv`;
      const headers = [
        'categoryId',
        'categoryName',
        'totalAmount',
        'percentage',
        'transactionCount',
      ];
      const rows = [headers];
      for (const c of breakdown.categories ?? []) {
        rows.push([
          c.categoryId,
          c.categoryName ?? '',
          String(c.totalAmount),
          String(c.percentage),
          String(c.transactionCount ?? 0),
        ]);
      }
      const csv = this.toCSV(rows);
      return { filename, contentType: 'text/csv; charset=utf-8', content: csv };
    }

    // trend
    if (type === 'trend') {
      const sd = startDate ?? new Date(new Date().getFullYear(), 0, 1);
      const ed = endDate ?? new Date();
      const trend = await this.trendSvc.getTrend(userId, 'monthly', sd, ed);
      if (format === 'json') {
        const filename = `cashflow-trend.json`;
        return {
          filename,
          contentType: 'application/json; charset=utf-8',
          content: JSON.stringify(trend),
        };
      }
      const filename = `cashflow-trend.csv`;
      const headers = ['period', 'income', 'expense', 'netCashFlow'];
      const rows = [headers];
      for (const p of trend.data ?? []) {
        rows.push([
          p.period,
          String(p.income),
          String(p.expense),
          String(p.netCashFlow),
        ]);
      }
      const csv = this.toCSV(rows);
      return { filename, contentType: 'text/csv; charset=utf-8', content: csv };
    }

    throw new BadRequestException('Invalid type');
  }
}
