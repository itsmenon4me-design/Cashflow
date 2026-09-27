import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeRange } from "@/features/reports/period";
import { ReportsPage } from "./reports-page";

const { exportReportMock, downloadExportMock } = vi.hoisted(() => ({
  exportReportMock: vi.fn(),
  downloadExportMock: vi.fn(),
}));

vi.mock("@/services/report.service", () => ({
  fromCents: (value: number | string | bigint) => Number(value ?? 0),
  downloadExport: downloadExportMock,
  reportService: {
    getSummary: vi.fn().mockResolvedValue({
      month: 8,
      year: 2026,
      summary: { income: "0", expense: "0", netCashFlow: "0", transactions: 0 },
      topExpenseCategories: [],
      topIncomeCategories: [],
    }),
    getCategoryBreakdown: vi.fn().mockResolvedValue({
      type: "expense",
      total: "0",
      categories: [],
    }),
    getCashflowTrend: vi.fn().mockResolvedValue({ type: "daily", data: [] }),
    exportReport: exportReportMock,
  },
}));

vi.mock("@/services/category.service", () => ({
  categoryService: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/services/transaction.service", () => ({
  toTransactionItem: vi.fn(),
  transactionService: { list: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock("@/components/charts/lazy-charts", () => ({
  LazyCategoryBreakdownCard: () => null,
  LazyCashflowTrendChart: () => null,
  LazyIncomeExpenseChartCard: () => null,
}));

vi.mock("@/components/reports/report-period-filter", () => ({
  ReportPeriodFilter: () => null,
}));

vi.mock("@/components/reports/summary-card", () => ({
  SummaryCard: () => null,
}));

vi.mock("@/components/reports/top-categories-card", () => ({
  TopCategoriesCard: () => null,
}));

vi.mock("@/components/reports/transaction-summary-card", () => ({
  TransactionSummaryCard: () => null,
}));

vi.mock("@/components/reports/category-breakdown-card", () => ({
  CategoryBreakdownCard: () => null,
}));

describe("ReportsPage export actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportReportMock.mockResolvedValue({
      filename: "report.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: "UEsDBAo=",
      contentEncoding: "base64",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("offers one XLSX download for the selected report range", async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    expect(
      screen.getByRole("button", { name: "Unduh Excel (.xlsx)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Download CSV" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Unduh Excel (.xlsx)" }),
    );
    await waitFor(() => {
      expect(exportReportMock).toHaveBeenCalledWith({
        type: "monthly",
        format: "xlsx",
        startDate: computeRange("thisMonth").startDate,
        endDate: computeRange("thisMonth").endDate,
      });
    });
    expect(downloadExportMock).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "report.xlsx" }),
    );
  });
});
