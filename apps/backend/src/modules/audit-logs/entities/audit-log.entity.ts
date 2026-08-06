export class AuditLogEntity {
  id!: string;
  user_id?: string | null;
  action!: string;
  module!: string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_method?: string | null;
  request_path?: string | null;
  response_status?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at!: Date;
}
