import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { SharedModule } from './shared/shared.module';
import { SystemModule } from './modules/system/system.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';

/**
 * Root application module.
 *
 * The global shared layer and future feature modules are wired here.
 */
@Module({
  imports: [
    ConfigModule,
    SharedModule,
    SystemModule,
    UsersModule,
    AuthModule,
    AuditLogsModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
