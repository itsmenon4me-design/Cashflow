import { Body, Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmailVerificationService } from '../services/email-verification.service';
import { UsersService } from '../../users/services/users.service';
import { MailService } from '../../../common/mail/mail.service';
import { MailConfigService } from '../../../config/mail-config.service';
import * as crypto from 'crypto';

class SendVerificationDto {
  email!: string;
}

class ResendVerificationDto {
  email!: string;
}

class ForgotPasswordDto {
  email!: string;
}

@ApiTags('Authentication')
@Controller('auth/email')
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(
    private readonly verification: EmailVerificationService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly mailCfg: MailConfigService,
  ) {}

  @Post('send-verification')
  @ApiOperation({ summary: 'Send email verification link' })
  @ApiResponse({ status: 200 })
  async send(@Body() body: SendVerificationDto) {
    const user = await this.users.findByEmail(body.email);
    if (!user) {
      // Do not reveal; respond success
      this.logger.debug('Send verification requested for unknown email');
      return { success: true };
    }

    await this.verification.sendVerificationEmail(user.id);
    return { success: true };
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify email token' })
  @ApiResponse({ status: 200 })
  async verify(@Query('token') token: string, @Query('id') id: string) {
    await this.verification.verifyToken(id, token);
    return { success: true };
  }

  @Post('resend')
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200 })
  async resend(@Body() body: ResendVerificationDto) {
    const user = await this.users.findByEmail(body.email);
    if (!user) {
      this.logger.debug('Resend verification requested for unknown email');
      return { success: true };
    }
    await this.verification.sendVerificationEmail(user.id);
    return { success: true };
  }

  @Post('/forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200 })
  async forgot(@Body() body: ForgotPasswordDto) {
    // Generic success response regardless of existence
    const generic = { success: true, message: 'If the email exists, a reset link has been sent' };

    const user = await this.users.findByEmail(body.email);
    if (!user) return generic;

    // Rate limit: simple check - allow one request per 60 seconds
    const now = Date.now();
    if (user.password_reset_requested_at && (now - new Date(user.password_reset_requested_at).getTime()) < 60 * 1000) {
      this.logger.warn(`Rate Limit Triggered for password reset: email=${body.email}`);
      return generic;
    }

    // Generate token
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.users.update(user.id, {
      password_reset_token_hash: hash,
      password_reset_expires_at: expiresAt,
      password_reset_requested_at: new Date(),
    } as any);

    const link = `${process.env.APP_URL ?? 'http://localhost:3001'}/api/v1/auth/reset-password?token=${raw}&id=${user.id}`;
    await this.mail.sendPasswordReset(user.email, user.full_name, link);

    return generic;
  }
}
