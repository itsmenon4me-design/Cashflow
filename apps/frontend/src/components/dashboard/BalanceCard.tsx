import { Wallet } from "lucide-react";
import { StatisticCard } from "@/components/dashboard/statistic-card";
import { uiText } from "@/locales";
import type { DashboardKpi } from "@/types/dashboard";

interface BalanceCardProps {
  kpi: DashboardKpi;
  loading?: boolean;
}

export function BalanceCard({ kpi, loading = false }: BalanceCardProps) {
  return (
    <StatisticCard
      label={uiText.dashboard.currentBalance}
      value={kpi.value}
      change={kpi.change}
      icon={Wallet}
      trend={kpi.trend}
      loading={loading}
    />
  );
}
