import { apiClient } from "@/lib/axios";

import { getCurrencySpec } from "@/lib/money";

export interface ReportPeriod {
  startDate: string;
  endDate: string;
}

export interface ReportCategoryTotal {
  categoryId: string;
  name: string | null;
  total: string;
}

export interface ReportSummary {
  month: number;
  year: number;
  summary: {
    income: string;
    expense: string;
    netCashFlow: string;
    transactions: number;
  };
  topExpenseCategories: ReportCategoryTotal[];
  topIncomeCategories: ReportCategoryTotal[];
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string | null;
  totalAmount: string;
  percentage: number;
  transactionCount: number;
}

export interface CategoryBreakdownResult {
  type: "income" | "expense";
  total: string;
  categories: CategoryBreakdownItem[];
}

export type TrendType = "daily" | "weekly" | "monthly";

export interface TrendPoint {
  period: string;
  income: string;
  expense: string;
  netCashFlow: string;
}

export interface TrendResult {
  type: TrendType;
  data: TrendPoint[];
}

export type ExportType = "monthly" | "category" | "trend";
export type ExportFormat = "csv";

export interface ReportExportResponse {
  filename: string;
  contentType: string;
  content: string;
}

export interface ReportExportParams {
  type: ExportType;
  format: ExportFormat;
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
}

/** Backend reports return exact minor-unit strings. Convert to major units only at the display boundary. */
export function fromCents(amount: number | string | bigint, currency = "IDR"): number {
  const parsed = typeof amount === "bigint" ? Number(amount) : Number(amount ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed / (10 ** getCurrencySpec(currency).minorUnits);
}

/** Download backend export content ({filename, contentType, content}) as a file. */
export function downloadExport(res: ReportExportResponse): void {
  if (!res || !res.content || !res.filename) {
    throw new Error("Empty export response");
  }
  const blob = new Blob([res.content], { type: res.contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = res.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const reportService = {
  getSummary: (period: ReportPeriod): Promise<ReportSummary> =>
    apiClient.get<ReportSummary>("/reports/monthly", {
      params: { startDate: period.startDate, endDate: period.endDate },
    }),

  getCategoryBreakdown: (
    type: "income" | "expense",
    period: ReportPeriod,
  ): Promise<CategoryBreakdownResult> =>
    apiClient.get<CategoryBreakdownResult>("/reports/category-breakdown", {
      params: { type, startDate: period.startDate, endDate: period.endDate },
    }),

  getCashflowTrend: (type: TrendType, period: ReportPeriod): Promise<TrendResult> =>
    apiClient.get<TrendResult>("/reports/cashflow-trend", {
      params: { type, startDate: period.startDate, endDate: period.endDate },
    }),

  exportReport: (params: ReportExportParams): Promise<ReportExportResponse> =>
    apiClient.get<ReportExportResponse>("/reports/export", {
      params: {
        type: params.type,
        format: params.format,
        month: params.month,
        year: params.year,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    }),
};
