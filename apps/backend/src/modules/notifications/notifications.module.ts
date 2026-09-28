import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationsController } from './controllers/notifications.controller';
import { PushSubscriptionsController } from './controllers/push-subscriptions.controller';
import { NotificationsService } from './services/notifications.service';
import { PushNotificationsService } from './services/push-notifications.service';
import { PrismaNotificationsRepository } from './repositories/prisma-notifications.repository';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController, PushSubscriptionsController],
  providers: [
    NotificationsService,
    PushNotificationsService,
    PrismaNotificationsRepository,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
