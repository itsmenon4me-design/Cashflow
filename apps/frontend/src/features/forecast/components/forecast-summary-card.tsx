import type { LucideIcon } from 'lucide-react';
import { SummaryCard } from '@/components/reports/summary-card';

interface ForecastSummaryCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  subtitle?: string;
}

export function ForecastSummaryCard({ label, value, icon, subtitle }: ForecastSummaryCardProps) {
  return <SummaryCard label={label} value={value} icon={icon} subtitle={subtitle} />;
}
