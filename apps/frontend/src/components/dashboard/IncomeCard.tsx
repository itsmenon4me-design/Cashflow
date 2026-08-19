import { ArrowDownToLine } from "lucide-react";
import { StatisticCard } from "@/components/dashboard/statistic-card";
import { uiText } from "@/locales";
import type { DashboardKpi } from "@/types/dashboard";

interface IncomeCardProps {
  kpi: DashboardKpi;
  loading?: boolean;
}

export function IncomeCard({ kpi, loading = false }: IncomeCardProps) {
  return (
    <StatisticCard
      label={uiText.dashboard.totalIncome}
      value={kpi.value}
      change={kpi.change}
      icon={ArrowDownToLine}
      trend={kpi.trend}
      loading={loading}
      emphasis
    />
  );
}
