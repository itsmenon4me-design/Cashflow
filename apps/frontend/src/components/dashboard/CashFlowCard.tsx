import { HandCoins } from "lucide-react";
import { StatisticCard } from "@/components/dashboard/statistic-card";
import { uiText } from "@/locales";
import type { DashboardKpi } from "@/types/dashboard";

interface CashFlowCardProps {
  kpi: DashboardKpi;
  loading?: boolean;
}

export function CashFlowCard({ kpi, loading = false }: CashFlowCardProps) {
  return (
    <StatisticCard
      label={uiText.dashboard.cashFlow}
      value={kpi.value}
      change={kpi.change}
      icon={HandCoins}
      trend={kpi.trend}
      loading={loading}
    />
  );
}
