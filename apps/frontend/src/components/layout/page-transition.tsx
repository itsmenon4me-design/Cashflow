"use client";

import { usePathname } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

interface PendingNavigation {
  id: number;
  pathname: string;
  sourceChildren: ReactNode;
  fallbackVisible: boolean;
}

const FALLBACK_DELAY_MS = 100;

function RouteContentReady({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady: () => void;
}) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return children;
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
export function RouteFallback({ pathname }: { pathname: string }) {
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
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);
  const navigationIdRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  const currentRouteRef = useRef({ pathname, children });
  currentRouteRef.current = { pathname, children };

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const destination = (event as CustomEvent<string>).detail;
      const currentRoute = currentRouteRef.current;
      if (destination && destination !== currentRoute.pathname) {
        if (fallbackTimerRef.current !== null) {
          window.clearTimeout(fallbackTimerRef.current);
        }

        const navigation: PendingNavigation = {
          id: ++navigationIdRef.current,
          pathname: destination,
          sourceChildren: currentRoute.children,
          fallbackVisible: false,
        };
        pendingNavigationRef.current = navigation;
        setPendingNavigation(navigation);

        fallbackTimerRef.current = window.setTimeout(() => {
          const current = pendingNavigationRef.current;
          const currentRoute = currentRouteRef.current;
          if (!current || current.id !== navigation.id) return;
          if (
            currentRoute.pathname === current.pathname &&
            currentRoute.children !== current.sourceChildren
          ) {
            return;
          }

          const visibleNavigation = { ...current, fallbackVisible: true };
          pendingNavigationRef.current = visibleNavigation;
          setPendingNavigation(visibleNavigation);
        }, FALLBACK_DELAY_MS);
      }
    };

    window.addEventListener("cashflow:navigate", onNavigate);
    return () => {
      window.removeEventListener("cashflow:navigate", onNavigate);
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, []);

  const destinationChildrenReady =
    pendingNavigation !== null &&
    pendingNavigation.pathname === pathname &&
    pendingNavigation.pathname ===
      (typeof window === "undefined" ? pathname : window.location.pathname) &&
    pendingNavigation.sourceChildren !== children;

  const clearPendingNavigation = useCallback(() => {
    pendingNavigationRef.current = null;
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    setPendingNavigation((current) =>
      current?.pathname === pathname ? null : current,
    );
  }, [pathname]);

  return (
    <div
      data-slot="page-transition"
      className="min-h-[calc(100dvh-8rem)] min-w-0 [overflow-anchor:none]"
    >
      {pendingNavigation?.fallbackVisible && !destinationChildrenReady ? (
        <RouteFallback pathname={pendingNavigation.pathname} />
      ) : (
        <Suspense
          fallback={
            pendingNavigation && !pendingNavigation.fallbackVisible
              ? pendingNavigation.sourceChildren
              : <RouteFallback pathname={pathname} />
          }
        >
          {destinationChildrenReady ? (
            <RouteContentReady onReady={clearPendingNavigation}>
              {children}
            </RouteContentReady>
          ) : (
            children
          )}
        </Suspense>
      )}
    </div>
  );
}
