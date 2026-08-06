import { AuditLogEntity } from '../entities/audit-log.entity';
import type {
  AuditLogCreateInput,
  AuditLogFilter,
  AuditLogPagination,
} from '../interfaces/audit-log.interface';

export interface IAuditLogRepository {
  create(data: AuditLogCreateInput): Promise<AuditLogEntity>;
  findById(id: string): Promise<AuditLogEntity | null>;
  findMany(
    filter: AuditLogFilter,
    pagination: AuditLogPagination,
  ): Promise<AuditLogEntity[]>;
  count(filter: AuditLogFilter): Promise<number>;
}
