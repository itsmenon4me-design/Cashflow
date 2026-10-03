import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  CreatePushSubscriptionDto,
  PushSubscriptionEndpointDto,
} from '../dto/push-subscription.dto';
import {
  NativePushTokenDto,
  RemoveNativePushTokenDto,
} from '../dto/native-push-token.dto';
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

  @Post('native-token')
  @ApiOperation({ summary: 'Register an Expo push token for a native device' })
  async registerNativeToken(
    @CurrentUser('sub') userId: string,
    @Body() input: NativePushTokenDto,
  ) {
    await this.push.saveNativeToken(userId, input);
    return { success: true };
  }

  @Post('native-token/remove')
  @ApiOperation({ summary: 'Remove an Expo push token from this account' })
  async removeNativeToken(
    @CurrentUser('sub') userId: string,
    @Body() input: RemoveNativePushTokenDto,
  ) {
    await this.push.removeNativeToken(userId, input.token);
    return { success: true };
  }
}
