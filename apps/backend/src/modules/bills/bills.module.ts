import { Module } from '@nestjs/common';
import { BillsController } from './controllers/bills.controller';
import { BillsService } from './services/bills.service';
import { PrismaBillsRepository } from './repositories/prisma-bills.repository';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [BillsController],
  providers: [BillsService, PrismaBillsRepository],
  exports: [BillsService],
})
export class BillsModule {}
