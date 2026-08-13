import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { SettingsController } from './controllers/settings.controller';
import { UserSettingsService } from './services/user-settings.service';
import { PrismaUserSettingsRepository } from './repositories/prisma-user-settings.repository';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [UserSettingsService, PrismaUserSettingsRepository],
  exports: [UserSettingsService],
})
export class SettingsModule {}
