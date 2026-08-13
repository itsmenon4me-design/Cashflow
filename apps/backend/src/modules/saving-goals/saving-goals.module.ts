import { Module } from '@nestjs/common';
import { SavingGoalsController } from './controllers/saving-goals.controller';
import { SavingGoalsService } from './services/saving-goals.service';
import { PrismaSavingGoalsRepository } from './repositories/prisma-saving-goals.repository';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [SavingGoalsController],
  providers: [SavingGoalsService, PrismaSavingGoalsRepository],
  exports: [SavingGoalsService],
})
export class SavingGoalsModule {}
