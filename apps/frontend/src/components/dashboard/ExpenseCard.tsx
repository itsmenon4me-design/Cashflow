import { ArrowUpFromLine } from "lucide-react";
import { StatisticCard } from "@/components/dashboard/statistic-card";
import { uiText } from "@/locales";
import type { DashboardKpi } from "@/types/dashboard";

interface ExpenseCardProps {
  kpi: DashboardKpi;
  loading?: boolean;
}

export function ExpenseCard({ kpi, loading = false }: ExpenseCardProps) {
  return (
    <StatisticCard
      label={uiText.dashboard.totalExpense}
      value={kpi.value}
      change={kpi.change}
      icon={ArrowUpFromLine}
      trend={kpi.trend}
      loading={loading}
    />
  );
}
