import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { PrismaNotificationsRepository } from './repositories/prisma-notifications.repository';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PrismaNotificationsRepository],
  exports: [NotificationsService],
})
export class NotificationsModule {}
