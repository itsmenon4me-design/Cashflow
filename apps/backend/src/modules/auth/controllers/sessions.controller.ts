import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { SessionService } from '../services/session.service';
import { SessionResponseDto } from '../dto/session-response.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@UseGuards(JwtAuthGuard)
@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  @ApiOperation({ summary: 'List active sessions for current user' })
  @ApiResponse({ status: 200, type: [SessionResponseDto] })
  async list(@CurrentUser('sub') userId: string): Promise<SessionResponseDto[]> {
    const items = await this.sessions.listForUser(userId);
    // map to DTO without sensitive fields
    return items.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      device_name: s.device_name ?? null,
      device_type: s.device_type ?? null,
      browser: s.browser ?? null,
      operating_system: s.operating_system ?? null,
      ip_address: s.ip_address ?? null,
      user_agent: s.user_agent ?? null,
      last_activity_at: s.last_activity_at,
      expires_at: s.expires_at,
      revoked_at: s.revoked_at ?? null,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200 })
  async revoke(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.sessions.revoke(id, userId);
    return { success: true };
  }

  @Delete()
  @ApiOperation({ summary: 'Revoke all sessions except current' })
  @ApiResponse({ status: 200 })
  async revokeAllExceptCurrent(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') currentSession?: string,
  ) {
    await this.sessions.revokeAllExcept(userId, currentSession);
    return { success: true };
  }
}
