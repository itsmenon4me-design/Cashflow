import { apiClient } from "@/lib/axios";
import type { AuditLogItem, AuditLogPagination } from "@/types/audit-log";

interface AuditLogDTO {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_method: string | null;
  request_path: string | null;
  response_status: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogListBody {
  success: boolean;
  message: string;
  data: AuditLogDTO[];
  meta: AuditLogPagination;
}

function toAuditLogItem(dto: AuditLogDTO): AuditLogItem {
  return {
    id: dto.id,
    userId: dto.user_id,
    action: dto.action,
    module: dto.module,
    description: dto.description,
    entityType: dto.entity_type,
    entityId: dto.entity_id,
    ipAddress: dto.ip_address,
    userAgent: dto.user_agent,
    requestMethod: dto.request_method,
    requestPath: dto.request_path,
    responseStatus: dto.response_status,
    metadata: dto.metadata,
    createdAt: dto.created_at,
  };
}

export interface AuditLogListParams {
  page?: number;
  limit?: number;
  action?: string;
  module?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AuditLogListResult {
  items: AuditLogItem[];
  pagination: AuditLogPagination;
}

export const auditLogService = {
  listOwn: async (
    params: AuditLogListParams = {},
  ): Promise<AuditLogListResult> => {
    const query: Record<string, unknown> = {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
    };
    if (params.action) query.action = params.action;
    if (params.module) query.module = params.module;
    if (params.fromDate) query.from = params.fromDate;
    if (params.toDate) query.to = params.toDate;

    const body = await apiClient.get<AuditLogListBody>("/audit-logs/me", {
      params: query,
    });
    return {
      items: body.data.map(toAuditLogItem),
      pagination: body.meta,
    };
  },

  getById: async (id: string): Promise<AuditLogItem> => {
    const body = await apiClient.get<{ success: boolean; data: AuditLogDTO }>(
      `/audit-logs/me/${id}`,
    );
    return toAuditLogItem(body.data);
  },

  deleteAllOwn: async (): Promise<number> => {
    const body = await apiClient.delete<{
      success: boolean;
      data: { deletedCount: number };
    }>("/audit-logs/me");
    return body.data.deletedCount;
  },
};
