import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit_log_metadata';

export interface AuditMetadata {
  action: string;
  module: string;
  entityType?: string;
  description?: string;
}

/**
 * Marks a route handler for automatic audit logging.
 *
 * The AuditInterceptor reads this metadata and records a request audit
 * entry (method, path, status, ip, user agent, actor user id, entity id)
 * once the handler completes - on success or failure.
 *
 * Only routes marked with this decorator are audited automatically.
 */
export const Audit = (
  action: string,
  module: string,
  entityType?: string,
  description?: string,
): MethodDecorator =>
  SetMetadata(AUDIT_METADATA_KEY, {
    action,
    module,
    entityType: entityType ?? undefined,
    description: description ?? undefined,
  } satisfies AuditMetadata);
