import { Body, Controller, Post, Delete, UseGuards } from '@nestjs/common';
import { AuthRateLimitGuard } from '../auth-rate-limit.guard';
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
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UsersService } from '../../users/services/users.service';
import { toUserResponse } from '../../users/mappers/user.mapper';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { Get } from '@nestjs/common';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @UseGuards(AuthRateLimitGuard)
  async login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(body);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @UseGuards(AuthRateLimitGuard)
  async register(@Body() body: CreateUserDto) {
    // Delegate to UsersService which handles hashing and role assignment
    const created = await this.users.create(body);
    return {
      success: true,
      message: 'Registration successful',
      data: toUserResponse(created),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('logout')
  @Audit(AuditAction.LOGOUT, AuditModule.AUTHENTICATION)
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 200 })
  async logout(
    @CurrentUser('sub') userId: string,
    @CurrentUser('sessionId') sessionId?: string,
  ) {
    await this.sessions.logoutCurrent(sessionId as string, userId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async me(@CurrentUser('sub') userId: string) {
    if (!userId) {
      throw ErrorService.create(ErrorCode.UNAUTHORIZED, 'Invalid token');
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw ErrorService.create(ErrorCode.UNAUTHORIZED, 'Invalid user');
    }

    return {
      success: true,
      message: 'User profile retrieved successfully',
      data: toUserResponse(user),
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue new tokens' })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  @UseGuards(AuthRateLimitGuard)
  async refresh(@Body() body: RefreshRequestDto): Promise<RefreshResponseDto> {
    return this.auth.refresh(body.refreshToken);
  }
}
