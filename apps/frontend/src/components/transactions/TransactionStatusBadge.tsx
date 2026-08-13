import { Badge } from "@/components/ui/badge";
import { uiText } from "@/locales";
import type { TransactionStatus } from "@/types/dashboard";

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
}

function getStatusConfig(): Record<TransactionStatus, { label: string; variant: "success" | "warning" | "danger" }> {
  return {
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
}

export function TransactionStatusBadge({ status }: TransactionStatusBadgeProps) {
  const config = getStatusConfig()[status];

  return (
    <Badge variant={config.variant} className="rounded-lg">
      {config.label}
    </Badge>
  );
}