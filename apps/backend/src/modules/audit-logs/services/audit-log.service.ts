import { Injectable, Logger } from '@nestjs/common';
import type { IAuditLogRepository } from '../repositories/audit-log.repository.interface';
import type {
  AuditLogRecordInput,
  AuditLogCreateInput,
} from '../interfaces/audit-log.interface';
import { AUDIT_SENSITIVE_KEYS } from '../constants/audit.constants';

/**
 * Reusable audit recording service.
 *
 * Other modules must call this service to record user activities
 * (login, logout, refresh token, password change, user lifecycle,
 * role / permission changes, ...).
 *
 * Recording is best-effort: it must never fail the main request.
 * Any storage failure is logged as a warning and swallowed.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly repo: IAuditLogRepository) {}

  /**
   * Records an audit entry. Never throws - failures are logged as warnings.
   */
  async record(input: AuditLogRecordInput): Promise<void> {
    try {
      const entry: AuditLogCreateInput = {
        user_id: input.userId ?? null,
        action: input.action,
        module: input.module,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        request_method: input.requestMethod ?? null,
        request_path: input.requestPath ?? null,
        response_status: input.responseStatus ?? null,
        metadata: input.metadata
          ? AuditLogService.sanitize(input.metadata)
          : null,
      };
      await this.repo.create(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Audit log write failed for ${input.action}: ${message}`,
      );
    }
  }

  /**
   * Strips sensitive keys from arbitrary metadata (recursively) so that
   * passwords, hashes, tokens and other secrets are never persisted.
   */
  static sanitize(value: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (AuditLogService.isSensitiveKey(key)) continue;
      if (Array.isArray(val)) {
        result[key] = (val as unknown[]).map((item: unknown) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            return AuditLogService.sanitize(item as Record<string, unknown>);
          }
          return item;
        });
      } else if (val && typeof val === 'object') {
        result[key] = AuditLogService.sanitize(val as Record<string, unknown>);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  private static isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
    return AUDIT_SENSITIVE_KEYS.some((sensitive) =>
      normalized.includes(sensitive.toLowerCase().replace(/[-_\s]/g, '')),
    );
  }
}
