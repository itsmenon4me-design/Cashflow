export interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  description: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  responseStatus: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
