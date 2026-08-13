import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { NotificationsService } from '../services/notifications.service';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'unread', required: false, enum: ['true', 'false'] })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: [
      'TRANSACTION',
      'BUDGET',
      'SAVING_GOAL',
      'ACCOUNT',
      'INVESTMENT',
      'SYSTEM',
    ],
  })
  @ApiResponse({ status: 200, type: NotificationResponseDto, isArray: true })
  async list(
    @CurrentUser('sub') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    const result = await this.notifications.list(userId, query);
    return { success: true, ...result };
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Unread count' })
  async unreadCount(@CurrentUser('sub') userId: string) {
    const unreadCount = await this.notifications.unreadCount(userId);
    return { success: true, data: { unreadCount } };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications of the user as read' })
  @ApiResponse({ status: 200, description: 'Updated count' })
  async readAll(@CurrentUser('sub') userId: string) {
    const updatedCount = await this.notifications.markAllRead(userId);
    return { success: true, data: { updatedCount } };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  async markRead(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const notification = await this.notifications.markRead(userId, id);
    return { success: true, data: notification };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification owned by the user' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.notifications.remove(userId, id);
    return { success: true };
  }
}
