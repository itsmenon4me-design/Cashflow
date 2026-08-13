import { AuditLogEntity } from '../entities/audit-log.entity';
import { AuditLogResponseDto } from '../dto/audit-log-response.dto';

export function toAuditLogResponse(e: AuditLogEntity): AuditLogResponseDto {
  return {
    id: e.id,
    user_id: e.user_id ?? null,
    action: e.action,
    module: e.module,
    description: e.description ?? null,
    entity_type: e.entity_type ?? null,
    entity_id: e.entity_id ?? null,
    ip_address: e.ip_address ?? null,
    user_agent: e.user_agent ?? null,
    request_method: e.request_method ?? null,
    request_path: e.request_path ?? null,
    response_status: e.response_status ?? null,
    metadata: e.metadata,
    created_at: e.created_at.toISOString(),
  };
}
