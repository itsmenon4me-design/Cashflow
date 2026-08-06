import { Module } from '@nestjs/common';
import { TransfersController } from './controllers/transfers.controller';
import { TransfersService } from './services/transfers.service';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TransactionValidationService } from '../transactions/services/validation/transaction-validation.service';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [TransfersController],
  providers: [TransfersService, TransactionValidationService],
  exports: [TransfersService],
})
export class TransfersModule {}
