"use client";

import { usePathname } from "next/navigation";
import { Children, type ReactNode } from "react";
import { TransactionPageLoading } from "@/components/transactions/TransactionPageLoading";
import { DataLoadingState } from "@/components/states/DataLoadingState";

interface PageTransitionProps {
  children: ReactNode;
}

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

  const title =
    pathname === "/reports"
      ? "Laporan Keuangan"
      : pathname === "/analytics"
        ? "Analitik Keuangan"
        : pathname === "/goals"
          ? "Target Tabungan"
          : pathname === "/budgets"
            ? "Anggaran"
            : "Memuat halaman";

  return (
    <div className="space-y-6">
      <div className="min-h-[72px]">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      </div>
      <DataLoadingState />
    </div>
  );
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
