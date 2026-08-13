export type NotificationType =
  | "TRANSACTION"
  | "BUDGET"
  | "SAVING_GOAL"
  | "ACCOUNT"
  | "INVESTMENT"
  | "SYSTEM"
  | "BUDGET_THRESHOLD"
  | "BUDGET_EXCEEDED"
  | "DAILY_RECORDING_REMINDER"
  | "DAILY_RECORDING_ESCALATION"
  | "RECORDING_RECOVERY";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}