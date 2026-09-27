"use client";

import { usePathname } from "next/navigation";
import { Children, type ReactNode } from "react";
import { TransactionPageLoading } from "@/components/transactions/TransactionPageLoading";
import {
  AnalyticsSkeleton,
  BudgetsSkeleton,
  CategoriesSkeleton,
  DashboardSkeleton,
  ForecastSkeleton,
  InvestmentsSkeleton,
  NotificationsSkeleton,
  AuditLogSkeleton,
  ProfileSkeleton,
  ReportsSkeleton,
  SettingsSkeleton,
  TablePageSkeleton,
} from "@/components/skeletons/page-skeletons";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Route-shaped placeholder shown for the frames where the router has swapped the
 * route but the destination component has not mounted yet.
 *
 * It MUST mirror the destination page's own section order. A single generic
 * centred box used to appear here, so navigating between two pages with
 * different sections (e.g. Anggaran, which has a KPI row, to Target Tabungan,
 * which does not) collapsed the outgoing cards into one container and then
 * expanded them again — a visible jump that read as cards bleeding through.
 */
function RouteFallback({ pathname }: { pathname: string }) {
  if (pathname === "/incomes") {
    return <TransactionPageLoading type="income" />;
  }
  if (pathname === "/expenses") {
    return <TransactionPageLoading type="expense" />;
  }
  if (pathname === "/transactions") {
    return <TransactionPageLoading type="all" />;
  }
  if (pathname === "/dashboard" || pathname === "/") {
    return <DashboardSkeleton />;
  }
  if (pathname === "/budgets") {
    return <BudgetsSkeleton />;
  }
  if (pathname === "/categories") {
    return <CategoriesSkeleton />;
  }
  if (pathname === "/goals" || pathname === "/bills") {
    return <TablePageSkeleton filterCols={3} showAdd={pathname === "/goals"} />;
  }
  if (pathname === "/investments") {
    return <InvestmentsSkeleton />;
  }
  if (pathname === "/reports") {
    return <ReportsSkeleton />;
  }
  if (pathname === "/analytics") {
    return <AnalyticsSkeleton />;
  }
  if (pathname === "/forecast") {
    return <ForecastSkeleton />;
  }
  if (pathname === "/notifications") {
    return <NotificationsSkeleton />;
  }
  if (pathname === "/profile") {
    return <ProfileSkeleton />;
  }
  if (pathname === "/settings") {
    return <SettingsSkeleton />;
  }
  if (pathname === "/audit-log" || pathname === "/log-aktivitas") {
    return <AuditLogSkeleton />;
  }

  return <TablePageSkeleton />;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <div
      data-slot="page-transition"
      className="min-h-[calc(100dvh-8rem)] min-w-0 [overflow-anchor:none]"
    >
      {Children.count(children) > 0 ? children : <RouteFallback pathname={pathname} />}
    </div>
  );
}
