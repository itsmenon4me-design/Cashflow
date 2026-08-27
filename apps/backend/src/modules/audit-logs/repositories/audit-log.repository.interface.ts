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
  findByUser(
    userId: string,
    filter: Omit<AuditLogFilter, 'userId'>,
    pagination: AuditLogPagination,
  ): Promise<AuditLogEntity[]>;
  countByUser(
    userId: string,
    filter: Omit<AuditLogFilter, 'userId'>,
  ): Promise<number>;
  findByIdOwned(id: string, userId: string): Promise<AuditLogEntity | null>;
  deleteAllByUser(userId: string): Promise<number>;
}
