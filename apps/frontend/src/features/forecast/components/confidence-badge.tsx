import { Badge } from '@/components/ui/badge';

interface ConfidenceBadgeProps {
  confidence: number;
  labels: {
    high: string;
    medium: string;
    low: string;
  };
}

export function ConfidenceBadge({ confidence, labels }: ConfidenceBadgeProps) {
  const isHigh = confidence >= 0.75;
  const isMedium = confidence >= 0.5;

  const label = isHigh ? labels.high : isMedium ? labels.medium : labels.low;
  const percent = `${Math.round(confidence * 100)}%`;

  return (
    <Badge
      variant={isHigh ? 'success' : isMedium ? 'warning' : 'danger'}
      className="rounded-full px-3 py-1"
      aria-label={`${label}: ${percent}`}
    >
      {label} · {percent}
    </Badge>
  );
}
