import { Module } from '@nestjs/common';
import { BudgetsController } from './controllers/budgets.controller';
import { BudgetsService } from './services/budgets.service';
import { PrismaBudgetsRepository } from './repositories/prisma-budgets.repository';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, AuditLogsModule, SettingsModule],
  controllers: [BudgetsController],
  providers: [BudgetsService, PrismaBudgetsRepository],
  exports: [BudgetsService],
})
export class BudgetsModule {}
