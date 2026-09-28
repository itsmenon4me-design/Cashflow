import type {
  CategoryResponse,
  DashboardSummaryResponse,
  ForecastResponse,
  PaginatedTransactionResponse,
  SpendingPredictionResponse,
  TransactionDTO,
} from "@/types/backend";
import type { BudgetResponse } from "@/services/budget.service";
import type { InvestmentResponse } from "@/services/investment.service";
import type { DashboardWidgetsResponse } from "@/services/dashboard.service";
import type { SavingGoalResponse } from "@/services/saving-goal.service";
import type {
  AnalyticsCashflow,
  AnalyticsHealth,
  AnalyticsOverview,
  AnalyticsSpending,
  AnalyticsTypeResult,
} from "@/services/analytics.service";
import type {
  CategoryBreakdownResult,
  ReportSummary,
  TrendResult,
  TrendType,
} from "@/services/report.service";

type DemoParams = Record<string, unknown> | undefined;

interface TransactionPattern {
  categoryId: string;
  type: "INCOME" | "EXPENSE";
  note: string;
  amount: number;
  day: number;
}

const TODAY = new Date();
const TODAY_KEY = dateKey(TODAY);
const CATEGORY_ROWS: CategoryResponse[] = [
  ["cat-income-salary", "Gaji", "INCOME", "briefcase-business", "Pemasukan rutin"],
  ["cat-income-freelance", "Freelance", "INCOME", "laptop", "Pemasukan proyek"],
  ["cat-income-bonus", "Bonus", "INCOME", "gift", "Bonus dan insentif"],
  ["cat-expense-food", "Makanan", "EXPENSE", "utensils", "Belanja makanan"],
  ["cat-expense-housing", "Rumah Tangga", "EXPENSE", "house", "Biaya rumah tangga"],
  ["cat-expense-transport", "Transportasi", "EXPENSE", "bus", "Transportasi harian"],
  ["cat-expense-utilities", "Tagihan", "EXPENSE", "receipt", "Tagihan rutin"],
  ["cat-expense-health", "Kesehatan", "EXPENSE", "heart-pulse", "Biaya kesehatan"],
  ["cat-expense-leisure", "Hiburan", "EXPENSE", "ticket", "Hiburan dan rekreasi"],
  ["cat-expense-shopping", "Belanja", "EXPENSE", "shopping-bag", "Belanja kebutuhan"],
  ["cat-expense-education", "Pendidikan", "EXPENSE", "book-open", "Kursus dan buku"],
].map(([id, name, type, icon, description]) => ({
  id,
  name,
  type: type as CategoryResponse["type"],
  icon,
  color: null,
  description: `[DATA DUMMY] ${description}`,
  is_system: false,
  is_active: true,
  created_at: "2026-01-01T12:00:00.000Z",
  updated_at: "2026-01-01T12:00:00.000Z",
}));

const PATTERNS: TransactionPattern[] = [
  { categoryId: "cat-income-salary", type: "INCOME", note: "Gaji bulanan", amount: 15_200_000, day: 25 },
  { categoryId: "cat-income-freelance", type: "INCOME", note: "Proyek freelance", amount: 2_800_000, day: 8 },
  { categoryId: "cat-income-bonus", type: "INCOME", note: "Pemasukan tambahan", amount: 1_200_000, day: 18 },
  { categoryId: "cat-expense-food", type: "EXPENSE", note: "Belanja bahan makanan", amount: 1_850_000, day: 4 },
  { categoryId: "cat-expense-housing", type: "EXPENSE", note: "Keperluan rumah tangga", amount: 2_100_000, day: 6 },
  { categoryId: "cat-expense-transport", type: "EXPENSE", note: "Transportasi harian", amount: 720_000, day: 10 },
  { categoryId: "cat-expense-utilities", type: "EXPENSE", note: "Tagihan bulanan", amount: 1_050_000, day: 13 },
  { categoryId: "cat-expense-health", type: "EXPENSE", note: "Kebutuhan kesehatan", amount: 480_000, day: 16 },
  { categoryId: "cat-expense-leisure", type: "EXPENSE", note: "Rekreasi", amount: 650_000, day: 20 },
  { categoryId: "cat-expense-shopping", type: "EXPENSE", note: "Belanja kebutuhan", amount: 900_000, day: 22 },
  { categoryId: "cat-expense-education", type: "EXPENSE", note: "Buku dan pembelajaran", amount: 375_000, day: 27 },
  { categoryId: "cat-expense-food", type: "EXPENSE", note: "Konsumsi hari ini", amount: 125_000, day: TODAY.getDate() },
  { categoryId: "cat-expense-transport", type: "EXPENSE", note: "Perjalanan hari ini", amount: 65_000, day: TODAY.getDate() },
  { categoryId: "cat-income-freelance", type: "INCOME", note: "Pemasukan hari ini", amount: 350_000, day: TODAY.getDate() },
];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateAt(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay), 12).toISOString();
}

function buildTransactions(): TransactionDTO[] {
  const rows: TransactionDTO[] = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const month = new Date(TODAY.getFullYear(), TODAY.getMonth() - offset, 1);
    for (const [index, pattern] of PATTERNS.entries()) {
      const rawDate = dateAt(month.getFullYear(), month.getMonth(), pattern.day);
      const transactionDate =
        offset === 0 && rawDate.slice(0, 10) > TODAY_KEY
          ? `${TODAY_KEY}T12:00:00.000Z`
          : rawDate;
      const cycleFactor = 1 + ((month.getMonth() + index) % 5) * 0.025;
      const amount = Math.round(pattern.amount * cycleFactor);
      rows.push({
        id: `demo-txn-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${index + 1}`,
        category_id: pattern.categoryId,
        transaction_type: pattern.type,
        amount_cents: String(amount),
        transaction_date: transactionDate,
        note: `[DATA DUMMY] ${pattern.note}`,
        created_at: transactionDate,
        updated_at: transactionDate,
      });
    }
  }
  return rows.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
}

const TRANSACTIONS = buildTransactions();
const CATEGORY_BY_ID = new Map(CATEGORY_ROWS.map((category) => [category.id, category]));

const INVESTMENTS: InvestmentResponse[] = [
  ["demo-investment-1", "Mutual Fund", "Platform simulasi", "Reksa Dana Pasar Uang", "RDPU", "125", "10000", "10650", "2026-01-15"],
  ["demo-investment-2", "Gold", "Platform simulasi", "Emas", "GOLD", "5", "1250000", "1375000", "2026-02-10"],
  ["demo-investment-3", "Stock", "Platform simulasi", "Saham Contoh", "DEMO", "20", "8200", "7900", "2026-03-12"],
  ["demo-investment-4", "Bond", "Platform simulasi", "Obligasi Contoh", "ORI-DEMO", "10", "1000000", "1040000", "2026-04-20"],
].map(([id, investment_type, platform, name, symbol, quantity, average_buy_price, current_price, purchase_date]) => {
  const invested = Number(quantity) * Number(average_buy_price);
  const current = Number(quantity) * Number(current_price);
  return {
    id,
    currency: "IDR",
    investment_type: investment_type as InvestmentResponse["investment_type"],
    platform,
    name: `[DATA DUMMY] ${name}`,
    symbol,
    quantity,
    average_buy_price,
    current_price,
    invested_amount_cents: String(invested),
    current_value_cents: String(current),
    profit_loss_cents: String(current - invested),
    profit_loss_percentage: String(invested ? ((current - invested) / invested) * 100 : 0),
    purchase_date,
    notes: "Instrumen simulasi, bukan rekomendasi investasi.",
    status: "ACTIVE",
    created_at: `${purchase_date}T12:00:00.000Z`,
    updated_at: `${purchase_date}T12:00:00.000Z`,
  };
});

const SAVING_GOALS: SavingGoalResponse[] = [
  ["demo-goal-1", "Dana darurat", 30_000_000, 18_500_000, "2026-01-01", "2026-12-31"],
  ["demo-goal-2", "Perjalanan", 12_000_000, 7_250_000, "2026-02-01", "2026-11-30"],
  ["demo-goal-3", "Perangkat kerja", 18_000_000, 18_000_000, "2026-01-15", "2026-09-30"],
].map(([id, name, target, current, start_date, target_date]) => ({
  id: String(id),
  user_id: "demo-user",
  category_id: null,
  currency: "IDR",
  name: `[DATA DUMMY] ${name}`,
  description: "Target simulasi untuk pratinjau aplikasi.",
  target_amount_cents: String(target),
  current_amount_cents: String(current),
  start_date: `${start_date}T12:00:00.000Z`,
  target_date: `${target_date}T12:00:00.000Z`,
  status: Number(current) >= Number(target) ? "COMPLETED" : "ACTIVE",
  created_at: `${start_date}T12:00:00.000Z`,
  updated_at: `${TODAY_KEY}T12:00:00.000Z`,
}));

let demoIdSequence = 0;
const ADDED_BUDGETS: BudgetResponse[] = [];
const UPDATED_BUDGETS = new Map<string, Partial<BudgetResponse>>();
const DELETED_BUDGET_IDS = new Set<string>();

function param(params: DemoParams, key: string): string | undefined {
  const value = params?.[key];
  return value === undefined || value === null ? undefined : String(value);
}

function transactionsInRange(params?: DemoParams): TransactionDTO[] {
  const from = param(params, "startDate") ?? param(params, "fromDate");
  const to = param(params, "endDate") ?? param(params, "toDate");
  return TRANSACTIONS.filter((transaction) => {
    const date = transaction.transaction_date.slice(0, 10);
    return (!from || date >= from) && (!to || date <= to);
  });
}

function totals(rows: TransactionDTO[]): { income: number; expense: number; net: number } {
  const income = rows.reduce(
    (sum, row) => sum + (row.transaction_type === "INCOME" ? Number(row.amount_cents) : 0),
    0,
  );
  const expense = rows.reduce(
    (sum, row) => sum + (row.transaction_type === "EXPENSE" ? Number(row.amount_cents) : 0),
    0,
  );
  return { income, expense, net: income - expense };
}

function groupedCategories(rows: TransactionDTO[], type: "INCOME" | "EXPENSE") {
  const amountByCategory = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    if (row.transaction_type !== type) continue;
    const current = amountByCategory.get(row.category_id) ?? { total: 0, count: 0 };
    current.total += Number(row.amount_cents);
    current.count += 1;
    amountByCategory.set(row.category_id, current);
  }
  const total = [...amountByCategory.values()].reduce((sum, item) => sum + item.total, 0);
  return [...amountByCategory.entries()]
    .map(([categoryId, item]) => ({
      categoryId,
      name: CATEGORY_BY_ID.get(categoryId)?.name ?? null,
      categoryName: CATEGORY_BY_ID.get(categoryId)?.name ?? null,
      total: String(item.total),
      totalAmount: String(item.total),
      percentage: total === 0 ? 0 : (item.total / total) * 100,
      transactionCount: item.count,
    }))
    .sort((a, b) => Number(b.total) - Number(a.total));
}

function monthlyTrend(rows: TransactionDTO[]) {
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const row of rows) {
    const period = row.transaction_date.slice(0, 7);
    const current = byMonth.get(period) ?? { income: 0, expense: 0 };
    current[row.transaction_type === "INCOME" ? "income" : "expense"] += Number(row.amount_cents);
    byMonth.set(period, current);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({
      period,
      income: String(value.income),
      expense: String(value.expense),
      netCashFlow: String(value.income - value.expense),
    }));
}

function overviewSummary(rows: TransactionDTO[]): DashboardSummaryResponse {
  const value = totals(rows);
  return {
    currency: "IDR",
    total_assets_cents: String(214_000_000 + value.net),
    total_income_cents: String(value.income),
    total_expense_cents: String(value.expense),
    net_cash_flow_cents: String(value.net),
    previous_net_cash_flow_cents: String(Math.round(value.net * 0.91)),
    total_categories: CATEGORY_ROWS.length,
    total_transactions: rows.length,
    last_updated_at: `${TODAY_KEY}T12:00:00.000Z`,
  };
}

function currentMonthRows(): TransactionDTO[] {
  const month = TODAY_KEY.slice(0, 7);
  return TRANSACTIONS.filter((row) => row.transaction_date.startsWith(month));
}

function budgetRows(): BudgetResponse[] {
  const limits: Record<string, number> = {
    "cat-expense-food": 3_000_000,
    "cat-expense-housing": 3_500_000,
    "cat-expense-transport": 1_200_000,
    "cat-expense-utilities": 1_500_000,
    "cat-expense-health": 900_000,
    "cat-expense-leisure": 1_000_000,
    "cat-expense-shopping": 1_500_000,
    "cat-expense-education": 700_000,
  };
  const currentMonth = TODAY_KEY.slice(0, 7);
  const months = [...new Set(TRANSACTIONS.map((row) => row.transaction_date.slice(0, 7)))].sort();
  const generated = months.flatMap((monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    const createdAt =
      monthKey === currentMonth ? `${TODAY_KEY}T12:00:00.000Z` : `${monthKey}-01T12:00:00.000Z`;

    return Object.entries(limits).map(([category_id, amount], index) => ({
      id:
        monthKey === currentMonth
          ? `demo-budget-${index + 1}`
          : `demo-budget-${monthKey}-${index + 1}`,
      category_id,
      category_name: CATEGORY_BY_ID.get(category_id)?.name ?? null,
      currency: "IDR",
      budget_amount_cents: String(amount),
      month,
      year,
      created_at: createdAt,
      updated_at: createdAt,
    }));
  });
  return [...generated, ...ADDED_BUDGETS]
    .filter((budget) => !DELETED_BUDGET_IDS.has(budget.id))
    .map((budget) => ({ ...budget, ...UPDATED_BUDGETS.get(budget.id) }));
}

function budgetWidget() {
  const budgets = budgetRows().filter(
    (budget) =>
      budget.month === TODAY.getMonth() + 1 && budget.year === TODAY.getFullYear(),
  );
  const expenses = currentMonthRows().filter((row) => row.transaction_type === "EXPENSE");
  const overallBudget = budgets.reduce((sum, item) => sum + Number(item.budget_amount_cents), 0);
  const overallSpent = expenses.reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const categories = budgets.map((budget) => {
    const spentAmount = expenses
      .filter((transaction) => transaction.category_id === budget.category_id)
      .reduce((sum, transaction) => sum + Number(transaction.amount_cents), 0);
    const budgetAmount = Number(budget.budget_amount_cents);
    const percentageUsed = budgetAmount === 0 ? 0 : (spentAmount / budgetAmount) * 100;
    return {
      categoryId: budget.category_id,
      categoryName: budget.category_name,
      budgetAmount,
      spentAmount,
      remainingAmount: Math.max(0, budgetAmount - spentAmount),
      percentageUsed,
      status: percentageUsed >= 100 ? "over" : percentageUsed >= 80 ? "warning" : "healthy",
    };
  });
  return {
    month: TODAY.getMonth() + 1,
    year: TODAY.getFullYear(),
    overall: {
      budget: overallBudget,
      spent: overallSpent,
      remaining: overallBudget - overallSpent,
      percentageUsed: overallBudget ? (overallSpent / overallBudget) * 100 : 0,
    },
    categories,
  };
}

function categoryBreakdown(params?: DemoParams): CategoryBreakdownResult {
  const type = param(params, "type") === "income" ? "INCOME" : "EXPENSE";
  const rows = transactionsInRange(params);
  const categories = groupedCategories(rows, type);
  return {
    type: type === "INCOME" ? "income" : "expense",
    total: String(categories.reduce((sum, item) => sum + Number(item.total), 0)),
    categories: categories.map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      totalAmount: item.totalAmount,
      percentage: item.percentage,
      transactionCount: item.transactionCount,
    })),
  };
}

function reportSummary(params?: DemoParams): ReportSummary {
  const rows = transactionsInRange(params);
  const value = totals(rows);
  return {
    month: Number(param(params, "month") ?? TODAY.getMonth() + 1),
    year: Number(param(params, "year") ?? TODAY.getFullYear()),
    summary: {
      income: String(value.income),
      expense: String(value.expense),
      netCashFlow: String(value.net),
      transactions: rows.length,
    },
    topExpenseCategories: groupedCategories(rows, "EXPENSE").slice(0, 5).map((item) => ({
      categoryId: item.categoryId,
      name: item.name,
      total: item.total,
    })),
    topIncomeCategories: groupedCategories(rows, "INCOME").slice(0, 5).map((item) => ({
      categoryId: item.categoryId,
      name: item.name,
      total: item.total,
    })),
  };
}

function trendResult(params?: DemoParams): TrendResult {
  const type = (param(params, "type") ?? "monthly") as TrendType;
  const data = monthlyTrend(transactionsInRange(params));
  return { type, data };
}

function analyticsType(type: "INCOME" | "EXPENSE", params?: DemoParams): AnalyticsTypeResult {
  const rows = transactionsInRange(params);
  const selected = rows.filter((row) => row.transaction_type === type);
  const categories = groupedCategories(rows, type);
  const amount = selected.reduce((sum, row) => sum + Number(row.amount_cents), 0);
  return {
    total: String(amount),
    transactionCount: selected.length,
    trend: monthlyTrend(rows),
    categories: categories.map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      totalAmount: item.totalAmount,
      percentage: item.percentage,
      transactionCount: item.transactionCount,
    })),
    top: categories.slice(0, 5).map((item) => ({
      categoryId: item.categoryId,
      name: item.name,
      total: item.total,
      percentage: item.percentage,
    })),
    comparison: 6.4,
    biggestCategory: categories[0]?.name ?? null,
    biggestCategoryPercentage: categories[0]?.percentage ?? null,
  };
}

function analyticsOverview(params?: DemoParams): AnalyticsOverview {
  const rows = transactionsInRange(params);
  const value = totals(rows);
  const savingRate = value.income ? (value.net / value.income) * 100 : 0;
  return {
    income: String(value.income),
    expense: String(value.expense),
    netCashFlow: String(value.net),
    savingRate,
    transactions: rows.length,
    comparison: { income: 5.2, expense: -2.1, netCashFlow: 11.4, savingRate: 3.2 },
  };
}

function analyticsCashflow(params?: DemoParams): AnalyticsCashflow {
  const rows = transactionsInRange(params);
  const value = totals(rows);
  const trend = monthlyTrend(rows);
  const surplusPeriods = trend.filter((item) => Number(item.netCashFlow) > 0).length;
  const deficitPeriods = trend.filter((item) => Number(item.netCashFlow) < 0).length;
  return {
    trend,
    totalIncome: String(value.income),
    totalExpense: String(value.expense),
    netCashFlow: String(value.net),
    surplusPeriods,
    deficitPeriods,
    status: value.net > 0 ? "surplus" : value.net < 0 ? "deficit" : "balanced",
  };
}

function analyticsSpending(params?: DemoParams): AnalyticsSpending {
  const rows = transactionsInRange(params);
  const expenses = rows.filter((row) => row.transaction_type === "EXPENSE");
  const amount = expenses.reduce((sum, row) => sum + Number(row.amount_cents), 0);
  const largest = expenses.reduce((max, row) => Math.max(max, Number(row.amount_cents)), 0);
  return {
    avgExpense: String(expenses.length ? Math.round(amount / expenses.length) : 0),
    largestExpense: String(largest),
    avgTransaction: String(rows.length ? Math.round(amount / rows.length) : 0),
    totalTransactions: rows.length,
    incomeTransactions: rows.filter((row) => row.transaction_type === "INCOME").length,
    expenseTransactions: expenses.length,
    byCategory: categoryBreakdown({ ...params, type: "expense" }).categories,
  };
}

function analyticsHealth(params?: DemoParams): AnalyticsHealth {
  const overview = analyticsOverview(params);
  const income = Number(overview.income);
  const expense = Number(overview.expense);
  const savingRate = overview.savingRate;
  const expenseRatio = income ? (expense / income) * 100 : 0;
  return {
    score: Math.max(0, Math.min(100, Math.round(55 + savingRate * 0.7 - expenseRatio * 0.1))),
    label: savingRate >= 20 ? "healthy" : savingRate >= 5 ? "moderate" : "risk",
    savingRate,
    expenseRatio,
    incomeVsExpense: income ? (expense / income) * 100 : null,
    netCashFlow: overview.netCashFlow,
    cashFlowPositive: Number(overview.netCashFlow) >= 0,
    spendingConcentration: 38.5,
  };
}

export function isDemoDataMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_DATA_MODE === "true";
}

export class DemoApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DemoApiError";
  }
}

function recordBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new DemoApiError(400, "Data formulir tidak valid untuk mode dummy.");
  }
  return body as Record<string, unknown>;
}

function requiredText(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new DemoApiError(400, `Kolom ${key} wajib diisi.`);
  }
  return value.trim();
}

function requiredAmount(body: Record<string, unknown>, key: string): number {
  const value = Number(body[key]);
  if (!Number.isFinite(value) || value < 0) {
    throw new DemoApiError(400, `Nilai ${key} tidak valid.`);
  }
  return value;
}

function demoTimestamp(): string {
  return new Date().toISOString();
}

function nextDemoId(kind: string): string {
  demoIdSequence += 1;
  return `demo-${kind}-${demoIdSequence}`;
}

export function mutateDemoResponse(
  path: string,
  method: string,
  body?: unknown,
): unknown {
  const payload = method === "DELETE" ? {} : recordBody(body);
  const now = demoTimestamp();

  if (path === "/transactions" && method === "POST") {
    const categoryId = requiredText(payload, "category_id");
    const transactionType = requiredText(payload, "transaction_type");
    if (!CATEGORY_BY_ID.has(categoryId) || !["INCOME", "EXPENSE"].includes(transactionType)) {
      throw new DemoApiError(400, "Kategori atau jenis transaksi tidak valid.");
    }
    const transaction: TransactionDTO = {
      id: nextDemoId("transaction"),
      category_id: categoryId,
      transaction_type: transactionType as TransactionDTO["transaction_type"],
      amount_cents: String(requiredAmount(payload, "amount_cents")),
      transaction_date: requiredText(payload, "transaction_date"),
      note: typeof payload.note === "string" ? payload.note : null,
      created_at: now,
      updated_at: now,
    };
    TRANSACTIONS.unshift(transaction);
    return { success: true, data: transaction };
  }
  const transactionId = path.match(/^\/transactions\/([^/]+)$/)?.[1];
  if (transactionId && method === "PATCH") {
    const transaction = TRANSACTIONS.find((row) => row.id === transactionId);
    if (!transaction) throw new DemoApiError(404, "Transaksi dummy tidak ditemukan.");
    if (typeof payload.category_id === "string") transaction.category_id = payload.category_id;
    if (payload.transaction_type === "INCOME" || payload.transaction_type === "EXPENSE") {
      transaction.transaction_type = payload.transaction_type;
    }
    if (payload.amount_cents !== undefined) transaction.amount_cents = String(requiredAmount(payload, "amount_cents"));
    if (typeof payload.transaction_date === "string") transaction.transaction_date = payload.transaction_date;
    if (typeof payload.note === "string" || payload.note === null) transaction.note = payload.note;
    transaction.updated_at = now;
    return { success: true, data: transaction };
  }
  if (transactionId && method === "DELETE") {
    const index = TRANSACTIONS.findIndex((row) => row.id === transactionId);
    if (index < 0) throw new DemoApiError(404, "Transaksi dummy tidak ditemukan.");
    TRANSACTIONS.splice(index, 1);
    return { success: true };
  }

  if (path === "/categories" && method === "POST") {
    const category: CategoryResponse = {
      id: nextDemoId("category"),
      name: requiredText(payload, "name"),
      type: requiredText(payload, "type") as CategoryResponse["type"],
      icon: typeof payload.icon === "string" ? payload.icon : null,
      color: typeof payload.color === "string" ? payload.color : null,
      description: typeof payload.description === "string" ? payload.description : null,
      is_system: false,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    if (category.type !== "INCOME" && category.type !== "EXPENSE") {
      throw new DemoApiError(400, "Jenis kategori tidak valid.");
    }
    CATEGORY_ROWS.unshift(category);
    CATEGORY_BY_ID.set(category.id, category);
    return { success: true, data: category };
  }
  const categoryId = path.match(/^\/categories\/([^/]+)$/)?.[1];
  if (categoryId && method === "PATCH") {
    const category = CATEGORY_BY_ID.get(categoryId);
    if (!category) throw new DemoApiError(404, "Kategori dummy tidak ditemukan.");
    if (typeof payload.name === "string") category.name = payload.name;
    if (payload.type === "INCOME" || payload.type === "EXPENSE") category.type = payload.type;
    if (typeof payload.icon === "string" || payload.icon === null) category.icon = payload.icon;
    if (typeof payload.color === "string" || payload.color === null) category.color = payload.color;
    if (typeof payload.description === "string" || payload.description === null) category.description = payload.description;
    category.updated_at = now;
    return { success: true, data: category };
  }
  if (categoryId && method === "DELETE") {
    const index = CATEGORY_ROWS.findIndex((row) => row.id === categoryId);
    if (index < 0) throw new DemoApiError(404, "Kategori dummy tidak ditemukan.");
    CATEGORY_ROWS.splice(index, 1);
    CATEGORY_BY_ID.delete(categoryId);
    return { success: true };
  }

  if (path === "/budgets" && method === "POST") {
    const categoryId = requiredText(payload, "category_id");
    if (!CATEGORY_BY_ID.has(categoryId)) throw new DemoApiError(400, "Kategori dummy tidak ditemukan.");
    const budget: BudgetResponse = {
      id: nextDemoId("budget"),
      category_id: categoryId,
      category_name: CATEGORY_BY_ID.get(categoryId)?.name ?? null,
      currency: "IDR",
      budget_amount_cents: String(requiredAmount(payload, "budget_amount_cents")),
      month: Number(payload.month),
      year: Number(payload.year),
      created_at: now,
      updated_at: now,
    };
    ADDED_BUDGETS.push(budget);
    return { success: true, data: budget };
  }
  const budgetId = path.match(/^\/budgets\/([^/]+)$/)?.[1];
  if (budgetId && method === "PATCH") {
    const budget = budgetRows().find((row) => row.id === budgetId);
    if (!budget) throw new DemoApiError(404, "Anggaran dummy tidak ditemukan.");
    const updated = {
      ...budget,
      ...(typeof payload.category_id === "string" ? { category_id: payload.category_id } : {}),
      ...(payload.budget_amount_cents !== undefined
        ? { budget_amount_cents: String(requiredAmount(payload, "budget_amount_cents")) }
        : {}),
      ...(typeof payload.month === "number" ? { month: payload.month } : {}),
      ...(typeof payload.year === "number" ? { year: payload.year } : {}),
      updated_at: now,
    };
    UPDATED_BUDGETS.set(budgetId, updated);
    return { success: true, data: updated };
  }
  if (budgetId && method === "DELETE") {
    if (!budgetRows().some((row) => row.id === budgetId)) {
      throw new DemoApiError(404, "Anggaran dummy tidak ditemukan.");
    }
    DELETED_BUDGET_IDS.add(budgetId);
    return { success: true };
  }

  if (path === "/saving-goals" && method === "POST") {
    const goal: SavingGoalResponse = {
      id: nextDemoId("goal"),
      user_id: "demo-user",
      category_id: typeof payload.category_id === "string" ? payload.category_id : null,
      currency: "IDR",
      name: requiredText(payload, "name"),
      description: typeof payload.description === "string" ? payload.description : null,
      target_amount_cents: String(requiredAmount(payload, "target_amount_cents")),
      current_amount_cents: String(payload.current_amount_cents ?? 0),
      start_date: requiredText(payload, "start_date"),
      target_date: requiredText(payload, "target_date"),
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    };
    SAVING_GOALS.unshift(goal);
    return { success: true, data: goal };
  }
  const goalId = path.match(/^\/saving-goals\/([^/]+)$/)?.[1];
  if (goalId && goalId !== "overview" && method === "PATCH") {
    const goal = SAVING_GOALS.find((row) => row.id === goalId);
    if (!goal) throw new DemoApiError(404, "Target dummy tidak ditemukan.");
    if (typeof payload.name === "string") goal.name = payload.name;
    if (typeof payload.description === "string" || payload.description === null) goal.description = payload.description;
    if (payload.target_amount_cents !== undefined) goal.target_amount_cents = String(requiredAmount(payload, "target_amount_cents"));
    if (payload.current_amount_cents !== undefined) goal.current_amount_cents = String(requiredAmount(payload, "current_amount_cents"));
    if (typeof payload.start_date === "string") goal.start_date = payload.start_date;
    if (typeof payload.target_date === "string") goal.target_date = payload.target_date;
    if (payload.status === "ACTIVE" || payload.status === "COMPLETED" || payload.status === "CANCELLED") goal.status = payload.status;
    goal.updated_at = now;
    return { success: true, data: goal };
  }
  if (goalId && goalId !== "overview" && method === "DELETE") {
    const index = SAVING_GOALS.findIndex((row) => row.id === goalId);
    if (index < 0) throw new DemoApiError(404, "Target dummy tidak ditemukan.");
    SAVING_GOALS.splice(index, 1);
    return { success: true };
  }

  if (path === "/investments" && method === "POST") {
    const quantity = requiredAmount(payload, "quantity");
    const averagePrice = requiredAmount(payload, "average_buy_price");
    const currentPrice = requiredAmount(payload, "current_price");
    const invested = Number(payload.invested_amount_cents ?? quantity * averagePrice);
    const current = quantity * currentPrice;
    const investment: InvestmentResponse = {
      id: nextDemoId("investment"),
      currency: "IDR",
      investment_type: requiredText(payload, "investment_type") as InvestmentResponse["investment_type"],
      platform: requiredText(payload, "platform"),
      name: requiredText(payload, "name"),
      symbol: typeof payload.symbol === "string" ? payload.symbol : null,
      quantity: String(quantity),
      average_buy_price: String(averagePrice),
      current_price: String(currentPrice),
      invested_amount_cents: String(invested),
      current_value_cents: String(current),
      profit_loss_cents: String(current - invested),
      profit_loss_percentage: String(invested ? ((current - invested) / invested) * 100 : 0),
      purchase_date: requiredText(payload, "purchase_date"),
      notes: typeof payload.notes === "string" ? payload.notes : null,
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    };
    INVESTMENTS.unshift(investment);
    return { success: true, data: investment };
  }
  const investmentId = path.match(/^\/investments\/([^/]+)$/)?.[1];
  if (investmentId && investmentId !== "overview" && method === "PATCH") {
    const investment = INVESTMENTS.find((row) => row.id === investmentId);
    if (!investment) throw new DemoApiError(404, "Investasi dummy tidak ditemukan.");
    if (typeof payload.name === "string") investment.name = payload.name;
    if (typeof payload.platform === "string") investment.platform = payload.platform;
    if (typeof payload.symbol === "string" || payload.symbol === null) investment.symbol = payload.symbol;
    if (typeof payload.notes === "string" || payload.notes === null) investment.notes = payload.notes;
    if (payload.quantity !== undefined) investment.quantity = String(requiredAmount(payload, "quantity"));
    if (payload.average_buy_price !== undefined) investment.average_buy_price = String(requiredAmount(payload, "average_buy_price"));
    if (payload.current_price !== undefined) investment.current_price = String(requiredAmount(payload, "current_price"));
    if (typeof payload.purchase_date === "string") investment.purchase_date = payload.purchase_date;
    if (payload.status === "ACTIVE" || payload.status === "SOLD" || payload.status === "CLOSED") investment.status = payload.status;
    const invested = Number(investment.quantity) * Number(investment.average_buy_price);
    const current = Number(investment.quantity) * Number(investment.current_price);
    investment.invested_amount_cents = String(invested);
    investment.current_value_cents = String(current);
    investment.profit_loss_cents = String(current - invested);
    investment.profit_loss_percentage = String(invested ? ((current - invested) / invested) * 100 : 0);
    investment.updated_at = now;
    return { success: true, data: investment };
  }
  if (investmentId && investmentId !== "overview" && method === "DELETE") {
    const index = INVESTMENTS.findIndex((row) => row.id === investmentId);
    if (index < 0) throw new DemoApiError(404, "Investasi dummy tidak ditemukan.");
    INVESTMENTS.splice(index, 1);
    return { success: true };
  }

  return undefined;
}

export function isDemoApiRoute(path: string): boolean {
  return [
    "/transactions",
    "/categories",
    "/budgets",
    "/saving-goals",
    "/investments",
    "/dashboard",
    "/analytics",
    "/reports",
    "/ai/forecast",
    "/ai/spending-prediction",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function getDemoResponse(path: string, params?: DemoParams): unknown {
  if (path === "/categories") return { success: true, data: CATEGORY_ROWS };
  if (path === "/categories/type/INCOME" || path === "/categories/type/EXPENSE") {
    const type = path.endsWith("INCOME") ? "INCOME" : "EXPENSE";
    return { success: true, data: CATEGORY_ROWS.filter((category) => category.type === type) };
  }
  const categoryId = path.match(/^\/categories\/([^/]+)$/)?.[1];
  if (categoryId) {
    const category = CATEGORY_BY_ID.get(categoryId);
    return { success: Boolean(category), data: category ?? null };
  }
  if (path === "/transactions" || path === "/transactions/search") {
    const query = (param(params, "q") ?? "").toLocaleLowerCase("id-ID");
    const type = param(params, "type");
    const categoryId = param(params, "categoryId");
    const filtered = transactionsInRange(params).filter((transaction) => {
      const category = CATEGORY_BY_ID.get(transaction.category_id);
      const matchesQuery =
        !query ||
        transaction.note?.toLocaleLowerCase("id-ID").includes(query) ||
        category?.name.toLocaleLowerCase("id-ID").includes(query);
      return (
        matchesQuery &&
        (!type || transaction.transaction_type === type) &&
        (!categoryId || transaction.category_id === categoryId)
      );
    });
    const sortBy = param(params, "sortBy") ?? "date";
    const sortOrder = param(params, "sortOrder") === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      const left = sortBy === "amount" ? Number(a.amount_cents) : a.transaction_date;
      const right = sortBy === "amount" ? Number(b.amount_cents) : b.transaction_date;
      return (left < right ? -1 : left > right ? 1 : 0) * sortOrder;
    });
    const page = Math.max(1, Number(param(params, "page") ?? 1));
    const limit = Math.max(1, Math.min(100, Number(param(params, "limit") ?? 10)));
    const data = path.endsWith("/search") ? filtered.slice(0, limit) : filtered.slice((page - 1) * limit, page * limit);
    const totalPages = Math.ceil(filtered.length / limit);
    const response: PaginatedTransactionResponse = {
      success: true,
      data,
      pagination: {
        page,
        limit,
        totalItems: filtered.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
    return response;
  }
  const transactionId = path.match(/^\/transactions\/([^/]+)$/)?.[1];
  if (transactionId) {
    const transaction = TRANSACTIONS.find((row) => row.id === transactionId);
    return { success: Boolean(transaction), data: transaction ?? null };
  }
  if (path === "/budgets") return { success: true, data: budgetRows() };
  const budgetId = path.match(/^\/budgets\/([^/]+)$/)?.[1];
  if (budgetId) {
    const budget = budgetRows().find((row) => row.id === budgetId);
    return { success: Boolean(budget), data: budget ?? null };
  }
  if (path === "/reports/budget-analysis") {
    const month = Number(param(params, "month") ?? TODAY.getMonth() + 1);
    const year = Number(param(params, "year") ?? TODAY.getFullYear());
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const budgets = budgetRows().filter(
      (budget) => budget.month === month && budget.year === year,
    );
    const spentByCategory = new Map<string, number>();
    for (const row of TRANSACTIONS) {
      if (
        row.transaction_date.startsWith(monthKey) &&
        row.transaction_type === "EXPENSE"
      ) {
        spentByCategory.set(
          row.category_id,
          (spentByCategory.get(row.category_id) ?? 0) + Number(row.amount_cents),
        );
      }
    }
    const categories = budgets.map((budget) => {
      const budgetAmount = Number(budget.budget_amount_cents);
      const spentAmount = spentByCategory.get(budget.category_id) ?? 0;
      return {
        categoryId: budget.category_id,
        categoryName: budget.category_name,
        budgetAmount,
        spentAmount,
        remainingAmount: budgetAmount - spentAmount,
        percentageUsed: budgetAmount ? (spentAmount / budgetAmount) * 100 : 0,
        status: spentAmount > budgetAmount ? "over" : "within",
      };
    });
    const budget = categories.reduce((sum, item) => sum + item.budgetAmount, 0);
    const spent = categories.reduce((sum, item) => sum + item.spentAmount, 0);
    return {
      month,
      year,
      overall: { budget, spent, remaining: budget - spent, percentageUsed: budget ? (spent / budget) * 100 : 0 },
      categories,
    };
  }
  if (path === "/saving-goals") return { success: true, data: SAVING_GOALS };
  const goalId = path.match(/^\/saving-goals\/([^/]+)$/)?.[1];
  if (goalId && goalId !== "overview") {
    const goal = SAVING_GOALS.find((row) => row.id === goalId);
    return { success: Boolean(goal), data: goal ?? null };
  }
  if (path === "/saving-goals/overview") {
    const active = SAVING_GOALS.filter((goal) => goal.status === "ACTIVE");
    const targetAmount = SAVING_GOALS.reduce((sum, goal) => sum + Number(goal.target_amount_cents), 0);
    const currentAmount = SAVING_GOALS.reduce((sum, goal) => sum + Number(goal.current_amount_cents), 0);
    return {
      success: true,
      data: {
        total: SAVING_GOALS.length,
        active: active.length,
        completed: SAVING_GOALS.length - active.length,
        targetAmount: String(targetAmount),
        currentAmount: String(currentAmount),
        percentageUsed: targetAmount ? (currentAmount / targetAmount) * 100 : 0,
      },
    };
  }
  if (path === "/investments") return { success: true, data: INVESTMENTS };
  const investmentId = path.match(/^\/investments\/([^/]+)$/)?.[1];
  if (investmentId && investmentId !== "overview") {
    const investment = INVESTMENTS.find((row) => row.id === investmentId);
    return { success: Boolean(investment), data: investment ?? null };
  }
  if (path === "/investments/overview") {
    const invested = INVESTMENTS.reduce((sum, item) => sum + Number(item.invested_amount_cents), 0);
    const value = INVESTMENTS.reduce((sum, item) => sum + Number(item.current_value_cents), 0);
    const profit = Math.max(0, value - invested);
    const loss = Math.max(0, invested - value);
    const allocation = new Map<string, number>();
    for (const item of INVESTMENTS) {
      allocation.set(item.investment_type, (allocation.get(item.investment_type) ?? 0) + Number(item.invested_amount_cents));
    }
    return {
      success: true,
      data: {
        total: INVESTMENTS.length,
        active: INVESTMENTS.filter((item) => item.status === "ACTIVE").length,
        totalInvested: String(invested),
        totalValue: String(value),
        totalProfit: String(profit),
        totalLoss: String(loss),
        roi: invested ? ((value - invested) / invested) * 100 : 0,
        allocation: [...allocation.entries()].map(([type, total]) => ({ type, total: String(total) })),
      },
    };
  }
  if (path === "/dashboard/summary") return overviewSummary(currentMonthRows());
  if (path === "/dashboard/widgets") {
    const rows = currentMonthRows();
    const current = totals(rows);
    const trend = monthlyTrend(TRANSACTIONS);
    const categories = groupedCategories(rows, "EXPENSE");
    const widget: DashboardWidgetsResponse = {
      summary: overviewSummary(rows),
      cashFlow: { income: current.income, expense: current.expense, netCashFlow: current.net, comparison: null },
      monthlyReport: {
        month: TODAY.getMonth() + 1,
        year: TODAY.getFullYear(),
        summary: { income: current.income, expense: current.expense, netCashFlow: current.net, transactions: rows.length },
      },
      categoryBreakdown: categories.map((item) => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName ?? "Lainnya",
        totalAmount: Number(item.total),
        percentage: current.expense ? Number(item.total) / current.expense : 0,
        transactionCount: item.transactionCount,
      })),
      trend: { type: "monthly", data: trend.map((item) => ({
        period: item.period,
        income: Number(item.income),
        expense: Number(item.expense),
        netCashFlow: Number(item.netCashFlow),
      })) },
      budget: budgetWidget(),
    };
    return widget;
  }
  if (path === "/reports/monthly") return reportSummary(params);
  if (path === "/reports/category-breakdown") return categoryBreakdown(params);
  if (path === "/reports/cashflow-trend") return trendResult(params);
  if (path === "/reports/export") {
    const rows = transactionsInRange(params);
    const csv = [
      "Tanggal,Kategori,Jenis,Jumlah,Catatan",
      ...rows.map((row) => {
        const note = (row.note ?? "").replaceAll('"', '""');
        return `${row.transaction_date.slice(0, 10)},${CATEGORY_BY_ID.get(row.category_id)?.name ?? ""},${row.transaction_type},${row.amount_cents},"${note}"`;
      }),
    ].join("\r\n");
    return { filename: "laporan-data-dummy.csv", contentType: "text/csv;charset=utf-8", content: csv };
  }
  if (path === "/analytics/overview") return analyticsOverview(params);
  if (path === "/analytics/income") return analyticsType("INCOME", params);
  if (path === "/analytics/expenses") return analyticsType("EXPENSE", params);
  if (path === "/analytics/cashflow") return analyticsCashflow(params);
  if (path === "/analytics/spending") return analyticsSpending(params);
  if (path === "/analytics/financial-health") return analyticsHealth(params);
  if (path === "/analytics/insights") {
    return [
      "[DATA DUMMY] Arus kas simulasi positif pada periode yang dipilih.",
      "[DATA DUMMY] Periksa kategori dengan pengeluaran tertinggi untuk melihat pembagian biaya.",
      "[DATA DUMMY] Angka pada halaman ini hanya untuk pratinjau, bukan saran keuangan.",
    ];
  }
  if (path === "/ai/forecast") {
    const horizon = Math.max(1, Math.min(12, Number(param(params, "horizon") ?? 6)));
    const basis = totals(currentMonthRows());
    const months = Array.from({ length: horizon }, (_, index) => {
      const date = new Date(TODAY.getFullYear(), TODAY.getMonth() + index + 1, 1);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const income = Math.round(basis.income * (1 + index * 0.005));
      const expense = Math.round(basis.expense * (1 + index * 0.003));
      return {
        period,
        projectedIncomeCents: String(income),
        projectedExpenseCents: String(expense),
        projectedNetCashflowCents: String(income - expense),
        projectedEndingBalanceCents: String(214_000_000 + (income - expense) * (index + 1)),
      };
    });
    const response: ForecastResponse = {
      currency: "IDR",
      horizon,
      months,
      confidence: 0.82,
      basis: {
        monthsUsed: 12,
        historyStart: TRANSACTIONS[TRANSACTIONS.length - 1]?.transaction_date.slice(0, 10) ?? TODAY_KEY,
        historyEnd: TODAY_KEY,
        totalIncomeCents: String(totals(TRANSACTIONS).income),
        totalExpenseCents: String(totals(TRANSACTIONS).expense),
        averageMonthlyIncomeCents: String(Math.round(totals(TRANSACTIONS).income / 12)),
        averageMonthlyExpenseCents: String(Math.round(totals(TRANSACTIONS).expense / 12)),
      },
      outliers: [],
      insufficientData: false,
    };
    return { success: true, data: response };
  }
  if (path === "/ai/spending-prediction") {
    const categories = groupedCategories(TRANSACTIONS, "EXPENSE").slice(0, 5);
    const total = categories.reduce((sum, item) => sum + Number(item.total), 0);
    const response: SpendingPredictionResponse = {
      currency: "IDR",
      period: TODAY_KEY.slice(0, 7),
      predictedTotalCents: String(total),
      confidence: 0.79,
      categories: categories.map((item) => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName ?? "Lainnya",
        predictedAmountCents: item.total,
        confidence: 0.78,
        basedOnMonths: 12,
      })),
      noHistoryCategoryIds: [],
      otherCents: "0",
      insufficientData: false,
    };
    return { success: true, data: response };
  }
  return undefined;
}
