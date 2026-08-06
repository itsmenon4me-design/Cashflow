"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: uiText.navigation.dashboard, href: "/", icon: Home },
  { label: uiText.navigation.accounts, href: "/accounts", icon: CreditCard },
  { label: uiText.navigation.income, href: "/incomes", icon: ArrowDownToLine },
  { label: uiText.navigation.expense, href: "/expenses", icon: ArrowUpFromLine },
  { label: uiText.navigation.transactions, href: "/transactions", icon: ReceiptText },
  { label: uiText.navigation.categories, href: "/categories", icon: Folder },
  { label: uiText.navigation.budgets, href: "/budgets", icon: PieChart },
  { label: uiText.navigation.goals, href: "/goals", icon: Target },
  { label: uiText.navigation.investments, href: "/investments", icon: TrendingUp },
  { label: uiText.navigation.reports, href: "/reports", icon: FileText },
  { label: uiText.navigation.analytics, href: "/analytics", icon: BarChart3 },
  { label: uiText.navigation.notifications, href: "/notifications", icon: Bell },
  { label: uiText.navigation.settings, href: "/settings", icon: Settings },
];

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label={uiText.common.openMenuAriaLabel}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === "/" ? pathname === "/" || pathname === "/dashboard" : pathname === item.href;

        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              collapsed ? "justify-center px-0" : "px-3",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        return link;
      })}
    </nav>
  );
}
