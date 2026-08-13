import { Module } from '@nestjs/common';
import { InvestmentsController } from './controllers/investments.controller';
import { InvestmentsService } from './services/investments.service';
import { PrismaInvestmentsRepository } from './repositories/prisma-investments.repository';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService, PrismaInvestmentsRepository],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
