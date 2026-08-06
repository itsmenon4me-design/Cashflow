import { Module } from '@nestjs/common';
import { TransactionsController } from './controllers/transactions.controller';
import { TransactionsService } from './services/transactions.service';
import { PrismaTransactionsRepository } from './repositories/prisma-transactions.repository';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TransactionValidationService } from './services/validation/transaction-validation.service';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    PrismaTransactionsRepository,
    TransactionValidationService,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
