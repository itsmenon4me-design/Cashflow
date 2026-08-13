export enum NotificationType {
  TRANSACTION = 'TRANSACTION',
  BUDGET = 'BUDGET',
  SAVING_GOAL = 'SAVING_GOAL',
  ACCOUNT = 'ACCOUNT',
  INVESTMENT = 'INVESTMENT',
  SYSTEM = 'SYSTEM',
}

export const NOTIFICATION_TYPES = Object.values(NotificationType) as string[];
