import { Body, Controller, Post, Delete, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { RefreshRequestDto } from '../dto/refresh-request.dto';
import { RefreshResponseDto } from '../dto/refresh-response.dto';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { SessionService } from '../services/session.service';
import { Audit } from '../../../common/audit/audit.decorator';
import {
  AuditAction,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('logout')
  @Audit(AuditAction.LOGOUT, AuditModule.AUTHENTICATION)
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 200 })
  async logout(
    @Req() req: Request & { user?: { sub?: string; sessionId?: string } },
  ) {
    const userId = req.user?.sub;
    const sessionId = req.user?.sessionId;
    await this.sessions.logoutCurrent(sessionId as string, userId as string);
    return { success: true };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue new tokens' })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  async refresh(@Body() body: RefreshRequestDto): Promise<RefreshResponseDto> {
    return this.auth.refresh(body.refreshToken);
  }
}
