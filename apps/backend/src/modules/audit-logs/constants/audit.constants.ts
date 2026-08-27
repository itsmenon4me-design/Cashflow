/**
 * Audit event catalog.
 *
 * Every important user activity must map to one of these actions so that
 * audit entries can be filtered and queried consistently across modules.
 */
export enum AuditAction {
  LOGIN = 'AUTH_LOGIN',
  LOGOUT = 'AUTH_LOGOUT',
  REFRESH_TOKEN = 'AUTH_REFRESH_TOKEN',
  PASSWORD_CHANGED = 'AUTH_PASSWORD_CHANGED',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  AUDIT_VIEW = 'AUDIT_VIEW',
  AUDIT_DELETE_ALL = 'AUDIT_DELETE_ALL',

  // Accounts
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_UPDATED = 'ACCOUNT_UPDATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  DEFAULT_ACCOUNT_CHANGED = 'DEFAULT_ACCOUNT_CHANGED',

  // Categories
  CATEGORY_CREATED = 'CATEGORY_CREATED',
  CATEGORY_UPDATED = 'CATEGORY_UPDATED',
  CATEGORY_DELETED = 'CATEGORY_DELETED',

  // Transactions
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED = 'TRANSACTION_UPDATED',
  TRANSACTION_DELETED = 'TRANSACTION_DELETED',
  // Transfers
  TRANSFER_CREATED = 'TRANSFER_CREATED',
  TRANSFER_FAILED = 'TRANSFER_FAILED',

  // Budgets
  BUDGET_CREATED = 'BUDGET_CREATED',
  BUDGET_UPDATED = 'BUDGET_UPDATED',
  BUDGET_DELETED = 'BUDGET_DELETED',

  // Saving Goals
  SAVING_GOAL_CREATED = 'SAVING_GOAL_CREATED',
  SAVING_GOAL_UPDATED = 'SAVING_GOAL_UPDATED',
  SAVING_GOAL_DELETED = 'SAVING_GOAL_DELETED',

  // Investments
  INVESTMENT_CREATED = 'INVESTMENT_CREATED',
  INVESTMENT_UPDATED = 'INVESTMENT_UPDATED',
  INVESTMENT_DELETED = 'INVESTMENT_DELETED',
}

/**
 * Module names used to group audit entries.
 */
export enum AuditModule {
  AUTHENTICATION = 'auth',
  USER = 'user',
  ROLE = 'role',
  PERMISSION = 'permission',
  ACCOUNT = 'account',
  CATEGORY = 'category',
  TRANSACTION = 'transaction',
  BUDGET = 'budget',
  SAVING_GOAL = 'saving_goal',
  INVESTMENT = 'investment',
  AUDIT = 'audit',
}

/**
 * Entity types recorded on audit entries.
 */
export enum AuditEntityType {
  USER = 'User',
  ROLE = 'Role',
  PERMISSION = 'Permission',
  SESSION = 'Session',
  AUDIT_LOG = 'AuditLog',
}

/**
 * Keys that must NEVER be persisted to audit logs.
 *
 * Any metadata containing these keys (case-insensitive, nested included)
 * is stripped before storage.
 */
export const AUDIT_SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'passwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'jwt',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'credit_card',
  'cvv',
  'ssn',
] as const;

/** Audit entries older than this retention window should be purged. */
export const AUDIT_RETENTION_DAYS = 90;
