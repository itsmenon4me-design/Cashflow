import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  CreatePushSubscriptionDto,
  PushSubscriptionEndpointDto,
} from '../dto/push-subscription.dto';
import { PushNotificationsService } from '../services/push-notifications.service';

@ApiTags('Push notifications')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('notifications/push')
export class PushSubscriptionsController {
  constructor(private readonly push: PushNotificationsService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get public Web Push configuration' })
  getConfig() {
    return { success: true, data: this.push.getPublicConfig() };
  }

  @Post('subscription')
  @ApiOperation({ summary: 'Register a push subscription for this account' })
  async subscribe(
    @CurrentUser('sub') userId: string,
    @Body() input: CreatePushSubscriptionDto,
  ) {
    await this.push.saveSubscription(userId, input);
    return { success: true };
  }

  @Post('subscription/remove')
  @ApiOperation({ summary: 'Remove a push subscription from this account' })
  async removeSubscription(
    @CurrentUser('sub') userId: string,
    @Body() input: PushSubscriptionEndpointDto,
  ) {
    await this.push.removeSubscription(userId, input);
    return { success: true };
  }
}
