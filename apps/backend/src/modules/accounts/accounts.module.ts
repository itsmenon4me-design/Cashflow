import { Module } from '@nestjs/common';
import { AccountsController } from './controllers/accounts.controller';
import { AccountsService } from './services/accounts.service';
import { PrismaAccountsRepository } from './repositories/prisma-accounts.repository';
import { PrismaModule } from '../../database/prisma.module';
import { LoggerModule } from '../../common/logger/logger.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { BalanceService } from './services/balance.service';

@Module({
  imports: [PrismaModule, LoggerModule, AuditLogsModule],
  controllers: [AccountsController],
  providers: [AccountsService, PrismaAccountsRepository, BalanceService],
  exports: [AccountsService, BalanceService],
})
export class AccountsModule {}
