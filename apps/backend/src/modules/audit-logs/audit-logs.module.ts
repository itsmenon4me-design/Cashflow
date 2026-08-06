import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaAuditLogRepository } from './repositories/prisma-audit-log.repository';
import { AuditLogService } from './services/audit-log.service';
import { AuditLogsService } from './services/audit-logs.service';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { AuditInterceptor } from '../../common/audit/audit.interceptor';

/**
 * Audit logging module.
 *
 * - AuditLogService: reusable recording service for all modules.
 * - AuditInterceptor: automatic request auditing for @Audit marked routes.
 * - AuditLogsController: SUPER_ADMIN only read API.
 */
@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [
    PrismaAuditLogRepository,
    AuditLogService,
    AuditLogsService,
    AuditInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditLogService, AuditLogsService],
})
export class AuditLogsModule {}
