import type {
  AnalyticsCashFlowPoint,
  AnalyticsDataset,
  AnalyticsRangeKey,
  AnalyticsTrendPoint,
  CashFlowPoint,
  DashboardKpi,
  DistributionPoint,
  FlowPoint,
  KpiKey,
  MonthlyTargetItem,
  NotificationItem,
  TransactionItem,
  UserProfile,
} from "@/types/dashboard";

export const mockUser: UserProfile = {
  name: "Ariana Wells",
  email: "ariana@cashflow.enterprise",
  plan: "Paket Premium",
};

export const dashboardKpis: Record<KpiKey, DashboardKpi> = {
  balance: { value: "Rp 248.420.000", change: "+4,2%", trend: [12, 16, 13, 20, 19, 24, 28] },
  income: { value: "Rp 56.860.000", change: "+8,1%", trend: [5, 8, 7, 11, 10, 14, 18] },
  expense: { value: "Rp 38.430.000", change: "-2,4%", trend: [14, 13, 12, 10, 12, 11, 9] },
  cashflow: { value: "Rp 18.430.000", change: "+12,8%", trend: [8, 11, 10, 13, 15, 17, 19] },
};

export const monthlyCashFlow: CashFlowPoint[] = [
  { month: "Jan", balance: 18200000 },
  { month: "Feb", balance: 19600000 },
  { month: "Mar", balance: 18900000 },
  { month: "Apr", balance: 21400000 },
  { month: "Mei", balance: 23100000 },
  { month: "Jun", balance: 24600000 },
  { month: "Jul", balance: 26400000 },
];

export const incomeExpenseData: FlowPoint[] = [
  { month: "Jan", income: 8200000, expense: 5100000 },
  { month: "Feb", income: 7800000, expense: 5300000 },
  { month: "Mar", income: 8600000, expense: 5700000 },
  { month: "Apr", income: 9100000, expense: 5900000 },
  { month: "Mei", income: 9800000, expense: 6100000 },
  { month: "Jun", income: 10100000, expense: 6400000 },
  { month: "Jul", income: 10800000, expense: 6200000 },
];

export const expenseCategories: DistributionPoint[] = [
  { name: "Makanan", value: 28 },
  { name: "Perumahan", value: 24 },
  { name: "Transportasi", value: 18 },
  { name: "Utilitas", value: 12 },
  { name: "Gaya Hidup", value: 10 },
  { name: "Lainnya", value: 8 },
];

export const recentTransactions: TransactionItem[] = [
  { id: "txn-001", date: "2026-08-04", category: "Gaji", description: "Gaji bulanan", account: "Bank BCA", amount: 15200000, type: "income", status: "completed" },
  { id: "txn-002", date: "2026-08-04", category: "Belanja", description: "Belanja bulanan", account: "Kartu Kredit", amount: 2850000, type: "expense", status: "completed" },
  { id: "txn-003", date: "2026-08-03", category: "Utilitas", description: "Tagihan listrik", account: "Bank Mandiri", amount: 780000, type: "expense", status: "pending" },
  { id: "txn-004", date: "2026-08-03", category: "Transportasi", description: "Isi bensin", account: "E-Wallet GoPay", amount: 350000, type: "expense", status: "completed" },
  { id: "txn-005", date: "2026-08-02", category: "Freelance", description: "Proyek desain", account: "Bank BCA", amount: 4200000, type: "income", status: "completed" },
  { id: "txn-006", date: "2026-08-02", category: "Perumahan", description: "Sewa apartemen", account: "Bank Mandiri", amount: 4500000, type: "expense", status: "completed" },
  { id: "txn-007", date: "2026-08-01", category: "Tabungan", description: "Transfer ke tabungan", account: "Bank BCA", amount: 3000000, type: "expense", status: "cancelled" },
  { id: "txn-008", date: "2026-07-31", category: "Gaya Hidup", description: "Langganan streaming", account: "Kartu Kredit", amount: 149000, type: "expense", status: "pending" },
  { id: "txn-009", date: "2026-07-30", category: "Kesehatan", description: "Asuransi kesehatan", account: "Bank Mandiri", amount: 620000, type: "expense", status: "completed" },
  { id: "txn-010", date: "2026-07-29", category: "Investasi", description: "Beli reksa dana", account: "Bank BCA", amount: 1500000, type: "expense", status: "completed" },
  { id: "txn-011", date: "2026-07-28", category: "Bisnis", description: "Penjualan online", account: "E-Wallet GoPay", amount: 2340000, type: "income", status: "pending" },
  { id: "txn-012", date: "2026-07-28", category: "Transportasi", description: "Tiket kereta", account: "Kartu Kredit", amount: 480000, type: "expense", status: "cancelled" },
  { id: "txn-013", date: "2026-07-27", category: "Makanan", description: "Makan siang tim", account: "E-Wallet GoPay", amount: 320000, type: "expense", status: "completed" },
  { id: "txn-014", date: "2026-07-26", category: "Gaji", description: "Bonus kinerja", account: "Bank BCA", amount: 3500000, type: "income", status: "completed" },
  { id: "txn-015", date: "2026-07-25", category: "Utilitas", description: "Tagihan internet", account: "Bank Mandiri", amount: 425000, type: "expense", status: "completed" },
  { id: "txn-016", date: "2026-07-24", category: "Belanja", description: "Belanja kebutuhan dapur", account: "Kas Tunai", amount: 640000, type: "expense", status: "completed" },
  { id: "txn-017", date: "2026-07-23", category: "Investasi", description: "Beli obligasi negara", account: "Bank BCA", amount: 2000000, type: "expense", status: "cancelled" },
  { id: "txn-018", date: "2026-07-22", category: "Bisnis", description: "Penjualan merchandise", account: "E-Wallet GoPay", amount: 1875000, type: "income", status: "completed" },
];

export const monthlyTargets: MonthlyTargetItem[] = [
  { id: "target-001", name: "Dana Darurat", target: 7000000, realized: 5180000 },
  { id: "target-002", name: "Dana Liburan", target: 5000000, realized: 2300000 },
];

export const notifications: NotificationItem[] = [
  { id: "notif-001", title: "Tagihan listrik jatuh tempo besok.", time: "2 jam lalu", type: "bill" },
  { id: "notif-002", title: "Target tabungan hampir tercapai.", time: "Kemarin", type: "goal" },
  { id: "notif-003", title: "Pemasukan bulan ini meningkat 8,1%.", time: "2 hari lalu", type: "income" },
];

export const aiInsights = [
  "Analisis pengeluaran menunjukkan selisih 6% terhadap target bulanan Anda.",
  "Tingkat tabungan Anda sedang berada di atas benchmark 30%.",
  "Prakiraan menunjukkan runway kas yang positif untuk 12 minggu ke depan.",
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const analyticsExpenseCategories: DistributionPoint[] = [
  { name: "Makanan", value: 2400000 },
  { name: "Transportasi", value: 900000 },
  { name: "Tagihan", value: 1100000 },
  { name: "Investasi", value: 1500000 },
  { name: "Hiburan", value: 500000 },
  { name: "Lainnya", value: 300000 },
];

const ANALYTICS_MONTHLY: AnalyticsCashFlowPoint[] = [
  { period: "Sep 24", income: 7800000, expense: 5100000, balance: 171100000 },
  { period: "Okt 24", income: 7900000, expense: 5300000, balance: 173700000 },
  { period: "Nov 24", income: 8100000, expense: 5600000, balance: 176200000 },
  { period: "Des 24", income: 9600000, expense: 6900000, balance: 178900000 },
  { period: "Jan 25", income: 8200000, expense: 5400000, balance: 181700000 },
  { period: "Feb 25", income: 8400000, expense: 5200000, balance: 184900000 },
  { period: "Mar 25", income: 8600000, expense: 5500000, balance: 188000000 },
  { period: "Apr 25", income: 8900000, expense: 5600000, balance: 191300000 },
  { period: "Mei 25", income: 9100000, expense: 5800000, balance: 194600000 },
  { period: "Jun 25", income: 9400000, expense: 6100000, balance: 197900000 },
  { period: "Jul 25", income: 9700000, expense: 6000000, balance: 201600000 },
  { period: "Agu 25", income: 9900000, expense: 6200000, balance: 205300000 },
  { period: "Sep 25", income: 9100000, expense: 5600000, balance: 208800000 },
  { period: "Okt 25", income: 9400000, expense: 5800000, balance: 212400000 },
  { period: "Nov 25", income: 8900000, expense: 6100000, balance: 215200000 },
  { period: "Des 25", income: 11200000, expense: 7400000, balance: 219000000 },
  { period: "Jan 26", income: 9600000, expense: 5900000, balance: 222700000 },
  { period: "Feb 26", income: 9300000, expense: 5400000, balance: 226600000 },
  { period: "Mar 26", income: 10100000, expense: 6200000, balance: 230500000 },
  { period: "Apr 26", income: 10400000, expense: 6000000, balance: 234900000 },
  { period: "Mei 26", income: 10800000, expense: 6500000, balance: 239200000 },
  { period: "Jun 26", income: 11000000, expense: 6800000, balance: 243400000 },
  { period: "Jul 26", income: 11500000, expense: 6400000, balance: 248500000 },
  { period: "Agu 26", income: 11900000, expense: 6700000, balance: 253700000 },
];

const MONTH_RANGE_COUNT: Partial<Record<AnalyticsRangeKey, number>> = {
  "3M": 3,
  "6M": 6,
  "1Y": 12,
};

function getDayLabel(date: Date): string {
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

function buildDailyCashFlow(days: number): AnalyticsCashFlowPoint[] {
  const points: AnalyticsCashFlowPoint[] = [];
  let balance = 250200000;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(2026, 7, 6 - i);
    const dayIndex = days - 1 - i;
    const income = Math.round((380000 + 14000 * dayIndex) * (1 + 0.3 * Math.sin(dayIndex * 1.7)));
    const expense = Math.round(income * (0.52 + 0.14 * Math.sin(dayIndex * 2.3)));
    balance += income - expense;
    points.push({ period: getDayLabel(date), income, expense, balance });
  }

  return points;
}

export function getAnalyticsDataset(range: AnalyticsRangeKey): AnalyticsDataset {
  const isDaily = range === "7D" || range === "30D";
  const monthCount = MONTH_RANGE_COUNT[range];
  const cashFlow = isDaily
    ? buildDailyCashFlow(range === "7D" ? 7 : 30)
    : ANALYTICS_MONTHLY.slice(monthCount === undefined ? 0 : -monthCount);

  const totalIncome = cashFlow.reduce((sum, point) => sum + point.income, 0);
  const totalExpense = cashFlow.reduce((sum, point) => sum + point.expense, 0);
  const topCategory = analyticsExpenseCategories.reduce((largest, item) =>
    item.value > largest.value ? item : largest
  );

  return {
    cashFlow,
    trend: cashFlow.map(
      (point): AnalyticsTrendPoint => ({ period: point.period, value: point.balance })
    ),
    avgExpense: Math.round(totalExpense / cashFlow.length),
    avgIncome: Math.round(totalIncome / cashFlow.length),
    netCashFlow: totalIncome - totalExpense,
    cashFlowPositive: totalIncome >= totalExpense,
    topCategoryName: topCategory.name,
    topCategoryValue: topCategory.value,
    granularity: isDaily ? "daily" : "monthly",
  };
}
