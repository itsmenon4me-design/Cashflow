import { Badge } from "@/components/ui/badge";
import { uiText } from "@/locales";
import type { TransactionStatus } from "@/types/dashboard";

const statusConfig: Record<TransactionStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  completed: {
    label: uiText.status.completed,
    variant: "success",
  },
  pending: {
    label: uiText.status.pending,
    variant: "warning",
  },
  cancelled: {
    label: uiText.status.cancelled,
    variant: "danger",
  },
};

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
}

export function TransactionStatusBadge({ status }: TransactionStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className="rounded-lg">
      {config.label}
    </Badge>
  );
}