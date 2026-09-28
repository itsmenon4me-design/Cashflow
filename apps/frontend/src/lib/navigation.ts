import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
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
import { uiText, type LocaleText } from "@/locales";

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
export function getAppMenuItems(text: LocaleText = uiText): AppMenuItem[] {
  return [
    {
      label: text.navigation.dashboard,
      href: "/dashboard",
      icon: Home,
      aliases: ["home", "ringkasan", "summary", "beranda", "dashboard"],
    },
    {
      label: text.navigation.income,
      href: "/incomes",
      icon: ArrowDownToLine,
      aliases: ["income", "pemasukan", "pendapatan", "incomes"],
    },
    {
      label: text.navigation.expense,
      href: "/expenses",
      icon: ArrowUpFromLine,
      aliases: ["expense", "pengeluaran", "biaya", "expenses"],
    },
    {
      label: text.navigation.transactions,
      href: "/transactions",
      icon: ReceiptText,
      aliases: ["transaction", "transaksi", "mutasi", "transactions"],
    },
    {
      label: text.navigation.categories,
      href: "/categories",
      icon: Folder,
      aliases: ["category", "kategori", "categories"],
    },
    {
      label: text.navigation.budgets,
      href: "/budgets",
      icon: PieChart,
      aliases: ["budget", "anggaran", "budgets"],
    },
    {
      label: text.navigation.goals,
      href: "/goals",
      icon: Target,
      aliases: ["goal", "target tabungan", "tabungan", "saving", "goals", "target"],
    },
    {
      label: text.navigation.investments,
      href: "/investments",
      icon: TrendingUp,
      aliases: ["investment", "investasi", "investments"],
    },
    {
      label: text.navigation.forecast,
      href: "/forecast",
      icon: Sparkles,
      aliases: ["forecast", "perkiraan", "proyeksi", "prediksi"],
    },
    {
      label: text.navigation.reports,
      href: "/reports",
      icon: FileText,
      aliases: ["report", "laporan", "reports"],
    },
    {
      label: text.navigation.analytics,
      href: "/analytics",
      icon: BarChart3,
      aliases: ["analytic", "analitik", "analisis", "statistik"],
    },
    {
      label: text.navigation.notifications,
      href: "/notifications",
      icon: Bell,
      aliases: ["notification", "notifikasi", "pemberitahuan"],
    },
    {
      label: text.navigation.auditLog,
      href: "/log-aktivitas",
      icon: ShieldCheck,
      aliases: ["audit", "audit log", "log", "riwayat aktivitas"],
    },
    {
      label: text.navigation.settings,
      href: "/settings",
      icon: Settings,
      aliases: ["setting", "pengaturan", "settings", "konfigurasi"],
    },
    {
      label: text.navigation.profile,
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
export function matchAppMenuItems(
  query: string,
  limit = 6,
  text: LocaleText = uiText,
): AppMenuItem[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const items = getAppMenuItems(text);
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
