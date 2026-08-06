import { Injectable } from '@nestjs/common';
import type { IAuditLogRepository } from '../repositories/audit-log.repository.interface';
import { AuditLogEntity } from '../entities/audit-log.entity';
import type {
  AuditLogFilter,
  AuditLogPagination,
} from '../interfaces/audit-log.interface';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';

/**
 * Read API for audit logs. Only used by the SUPER_ADMIN guarded endpoints.
 */
@Injectable()
export class AuditLogsService {
  constructor(private readonly repo: IAuditLogRepository) {}

  async findById(id: string): Promise<AuditLogEntity> {
    const entry = await this.repo.findById(id);
    if (!entry) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Audit log not found');
    }
    return entry;
  }

  async findMany(
    filter: AuditLogFilter,
    pagination: AuditLogPagination,
  ): Promise<{ items: AuditLogEntity[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.findMany(filter, pagination),
      this.repo.count(filter),
    ]);
    return { items, total };
  }
}
