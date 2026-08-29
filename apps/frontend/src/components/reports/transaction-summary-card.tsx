"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatTransactionDate } from "@/lib/format";
import { transactionTone } from "@/lib/transaction-tone";
import { uiText } from "@/locales";
import type { TransactionItem } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface TransactionSummaryCardProps {
  data: TransactionItem[];
  loading?: boolean;
}

export function TransactionSummaryCard({ data, loading = false }: TransactionSummaryCardProps) {
  return (
    <ChartCard
      title={uiText.reports.transactionSummary}
      subtitle={uiText.reports.transactionSummarySubtitle}
      loading={loading}
      empty={!data || data.length === 0}
      contentClassName="h-72 overflow-y-auto"
      actions={
        <Link
          href="/transactions"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {uiText.reports.viewAll}
          <ChevronRight className="size-3.5" />
        </Link>
      }
    >
      <ul className="divide-y divide-border">
        {data.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={tx.type === "income" ? "default" : "secondary"}
                  className="px-1.5 py-0 text-[10px] uppercase"
                >
                  {tx.type === "income" ? uiText.reports.income : uiText.reports.expense}
                </Badge>
                <span className="truncate text-sm font-medium text-foreground">{tx.category}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {tx.description}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-sm font-semibold",
                  transactionTone(tx.type).amountClass
                )}
              >
                {transactionTone(tx.type).sign}
                {formatMoney(tx.amount)}
              </p>
              <p className="text-xs text-muted-foreground">{formatTransactionDate(tx.dateTime ?? tx.date)}</p>
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}