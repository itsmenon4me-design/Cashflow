/**
 * Payload accepted when recording an audit entry.
 *
 * Metadata is optional and will be sanitized before persistence to guarantee
 * that passwords, hashes, tokens and other secrets are never stored.
 */
export interface AuditLogRecordInput {
  userId?: string | null;
  action: string;
  module: string;
  description?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  responseStatus?: number | null;
  metadata?: Record<string, unknown> | null;
}

/** Persistable form of an audit entry. */
export interface AuditLogCreateInput {
  user_id?: string | null;
  action: string;
  module: string;
  description?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_method?: string | null;
  request_path?: string | null;
  response_status?: number | null;
  metadata?: Record<string, unknown> | null;
}

/** Filters supported by the audit log read API. */
export interface AuditLogFilter {
  userId?: string;
  action?: string;
  module?: string;
  from?: Date;
  to?: Date;
}

export interface AuditLogPagination {
  page: number;
  limit: number;
}
