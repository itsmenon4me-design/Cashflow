import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogEntity } from '../entities/audit-log.entity';
import type { IAuditLogRepository } from './audit-log.repository.interface';
import type {
  AuditLogCreateInput,
  AuditLogFilter,
  AuditLogPagination,
} from '../interfaces/audit-log.interface';
import type {
  AuditLog as PrismaAuditLog,
  Prisma,
} from '../../../generated/prisma/client';

@Injectable()
export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: PrismaAuditLog): AuditLogEntity {
    const e = new AuditLogEntity();
    e.id = rec.id;
    e.user_id = rec.user_id;
    e.action = rec.action;
    e.module = rec.module;
    e.description = rec.description;
    e.entity_type = rec.entity_type;
    e.entity_id = rec.entity_id;
    e.ip_address = rec.ip_address;
    e.user_agent = rec.user_agent;
    e.request_method = rec.request_method;
    e.request_path = rec.request_path;
    e.response_status = rec.response_status;
    e.metadata = rec.metadata as unknown as Record<string, unknown> | null;
    e.created_at = rec.created_at;
    return e;
  }

  private buildWhere(filter: AuditLogFilter): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (filter.userId) where.user_id = filter.userId;
    if (filter.action) where.action = filter.action;
    if (filter.module) where.module = filter.module;
    if (filter.from || filter.to) {
      where.created_at = {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      };
    }
    return where;
  }

  async create(data: AuditLogCreateInput): Promise<AuditLogEntity> {
    const rec = await this.prisma.auditLog.create({
      data: {
        user_id: data.user_id,
        action: data.action,
        module: data.module,
        description: data.description ?? null,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        request_method: data.request_method,
        request_path: data.request_path,
        response_status: data.response_status,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
    return this.map(rec);
  }

  async findById(id: string): Promise<AuditLogEntity | null> {
    const rec = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!rec) return null;
    return this.map(rec);
  }

  async findMany(
    filter: AuditLogFilter,
    pagination: AuditLogPagination,
  ): Promise<AuditLogEntity[]> {
    const recs = await this.prisma.auditLog.findMany({
      where: this.buildWhere(filter),
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return recs.map((r) => this.map(r));
  }

  async count(filter: AuditLogFilter): Promise<number> {
    return this.prisma.auditLog.count({
      where: this.buildWhere(filter),
    });
  }

  async findByUser(
    userId: string,
    filter: Omit<AuditLogFilter, 'userId'>,
    pagination: AuditLogPagination,
  ): Promise<AuditLogEntity[]> {
    const where: Prisma.AuditLogWhereInput = {
      ...this.buildWhere(filter),
      user_id: userId,
    };
    const recs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return recs.map((r) => this.map(r));
  }

  async countByUser(
    userId: string,
    filter: Omit<AuditLogFilter, 'userId'>,
  ): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        ...this.buildWhere(filter),
        user_id: userId,
      },
    });
  }

  async findByIdOwned(
    id: string,
    userId: string,
  ): Promise<AuditLogEntity | null> {
    const rec = await this.prisma.auditLog.findFirst({
      where: { id, user_id: userId },
    });
    return rec ? this.map(rec) : null;
  }
}
