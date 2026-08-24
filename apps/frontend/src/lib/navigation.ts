import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  CreditCard,
  FileText,
  Folder,
  Home,
  PieChart,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { uiText } from "@/locales";

export interface AppMenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Alternative keywords (lowercase) that should also match this menu. */
  aliases: string[];
}

/**
 * Single source of truth for the app's page navigation: consumed by the
 * sidebar and by the global search quick-nav (Menu group).
 */
export function getAppMenuItems(): AppMenuItem[] {
  return [
    {
      label: uiText.navigation.dashboard,
      href: "/dashboard",
      icon: Home,
      aliases: ["home", "ringkasan", "summary", "beranda", "dashboard"],
    },
    {
      label: uiText.navigation.accounts,
      href: "/accounts",
      icon: CreditCard,
      aliases: ["account", "rekening", "akun"],
    },
    {
      label: uiText.navigation.income,
      href: "/incomes",
      icon: ArrowDownToLine,
      aliases: ["income", "pemasukan", "pendapatan", "incomes"],
    },
    {
      label: uiText.navigation.expense,
      href: "/expenses",
      icon: ArrowUpFromLine,
      aliases: ["expense", "pengeluaran", "biaya", "expenses"],
    },
    {
      label: uiText.navigation.transactions,
      href: "/transactions",
      icon: ReceiptText,
      aliases: ["transaction", "transaksi", "mutasi", "transactions"],
    },
    {
      label: uiText.navigation.categories,
      href: "/categories",
      icon: Folder,
      aliases: ["category", "kategori", "categories"],
    },
    {
      label: uiText.navigation.budgets,
      href: "/budgets",
      icon: PieChart,
      aliases: ["budget", "anggaran", "budgets"],
    },
    {
      label: uiText.navigation.goals,
      href: "/goals",
      icon: Target,
      aliases: ["goal", "target tabungan", "tabungan", "saving", "goals", "target"],
    },
    {
      label: uiText.navigation.investments,
      href: "/investments",
      icon: TrendingUp,
      aliases: ["investment", "investasi", "investments"],
    },
    {
      label: uiText.navigation.forecast,
      href: "/forecast",
      icon: Sparkles,
      aliases: ["forecast", "perkiraan", "proyeksi", "prediksi"],
    },
    {
      label: uiText.navigation.reports,
      href: "/reports",
      icon: FileText,
      aliases: ["report", "laporan", "reports"],
    },
    {
      label: uiText.navigation.analytics,
      href: "/analytics",
      icon: BarChart3,
      aliases: ["analytic", "analitik", "analisis", "statistik"],
    },
    {
      label: uiText.navigation.notifications,
      href: "/notifications",
      icon: Bell,
      aliases: ["notification", "notifikasi", "pemberitahuan"],
    },
    {
      label: uiText.navigation.auditLog,
      href: "/audit-log",
      icon: ShieldCheck,
      aliases: ["audit", "audit log", "log", "riwayat aktivitas"],
    },
    {
      label: uiText.navigation.settings,
      href: "/settings",
      icon: Settings,
      aliases: ["setting", "pengaturan", "settings", "konfigurasi"],
    },
    {
      label: uiText.navigation.profile,
      href: "/profile",
      icon: UserRound,
      aliases: ["profile", "profil", "akun saya", "user"],
    },
  ];
}

/**
 * Case-insensitive quick-nav matching: a menu matches when the query is a
 * substring of its label, one of its aliases, or its route path.
 */
export function matchAppMenuItems(query: string, limit = 6): AppMenuItem[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const items = getAppMenuItems();
  const starts: AppMenuItem[] = [];
  const contains: AppMenuItem[] = [];
  for (const item of items) {
    const haystacks = [item.label.toLowerCase(), ...item.aliases, item.href];
    const isStart = haystacks.some((h) => h.startsWith(q));
    const isContains = haystacks.some((h) => h.includes(q));
    if (isStart) starts.push(item);
    else if (isContains) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
}
