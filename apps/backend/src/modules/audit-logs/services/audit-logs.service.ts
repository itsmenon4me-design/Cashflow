import { Injectable } from '@nestjs/common';
import { PrismaAuditLogRepository } from '../repositories/prisma-audit-log.repository';
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
  constructor(private readonly repo: PrismaAuditLogRepository) {}

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

  async findOwnByUser(
    userId: string,
    filter: Omit<AuditLogFilter, 'userId'>,
    pagination: AuditLogPagination,
  ): Promise<{ items: AuditLogEntity[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.findByUser(userId, filter, pagination),
      this.repo.countByUser(userId, filter),
    ]);
    return { items, total };
  }

  async findOwnById(userId: string, id: string): Promise<AuditLogEntity> {
      const entry = await this.repo.findByIdOwned(id, userId);
      if (!entry) {
        throw ErrorService.create(ErrorCode.NOT_FOUND, 'Audit log not found');
      }
      return entry;
    }

    async deleteAllByUser(userId: string): Promise<number> {
      return this.repo.deleteAllByUser(userId);
    }
  }
