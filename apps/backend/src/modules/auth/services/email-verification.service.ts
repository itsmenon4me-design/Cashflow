import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { UsersService } from '../../users/services/users.service';
import { MailService } from '../../../common/mail/mail.service';
import { MailConfigService } from '../../../config/mail-config.service';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { PrismaUsersRepository } from '../../users/repositories/prisma-users.repository';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly mailCfg: MailConfigService,
    private readonly usersRepo: PrismaUsersRepository,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async sendVerificationEmail(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw ErrorService.create(ErrorCode.NOT_FOUND, 'User not found');

    if (!this.mailCfg.config.emailVerificationEnabled) {
      this.logger.debug('Email verification disabled by configuration');
      return;
    }

    const raw = this.generateRawToken();
    const hash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store hash and expiry using users repository (accepts Partial<UserEntity>)
    await this.usersRepo.update(user.id, {
      verification_token_hash: hash,
      verification_token_expires_at: expiresAt,
    });

    // Build verification link (frontend will handle token)
    const link = `${process.env.APP_URL ?? 'http://localhost:3001'}/api/v1/auth/email/verify?token=${raw}&id=${user.id}`;

    try {
      await this.mail.sendVerification(user.email, user.full_name, link);
      this.logger.log(`Verification Sent: user=${user.id} email=${user.email}`);
    } catch (err) {
      this.logger.error(
        `Failed to deliver verification email: user=${user.id} email=${user.email} error=${(err as Error).message}`,
      );
      throw err;
    }
  }

  async verifyToken(userId: string, token: string) {
    const user = await this.users.findById(userId);
    if (!user) throw ErrorService.create(ErrorCode.NOT_FOUND, 'Invalid token');

    if (!user.verification_token_hash || !user.verification_token_expires_at) {
      this.logger.warn(`Verification Failed: no token present user=${userId}`);
      throw ErrorService.create(ErrorCode.INVALID_TOKEN);
    }

    if (new Date() > new Date(user.verification_token_expires_at)) {
      this.logger.warn(`Verification Failed: token expired user=${userId}`);
      // invalidate stored token
      await this.usersRepo.update(user.id, {
        verification_token_hash: null,
        verification_token_expires_at: null,
      });
      throw ErrorService.create(ErrorCode.EXPIRED_TOKEN);
    }

    const hash = this.hashToken(token);
    if (hash !== user.verification_token_hash) {
      this.logger.warn(`Verification Failed: invalid token user=${userId}`);
      throw ErrorService.create(ErrorCode.INVALID_TOKEN);
    }

    // Success: update email_verified_at and clear token fields
    await this.usersRepo.update(user.id, {
      email_verified_at: new Date(),
      verification_token_hash: null,
      verification_token_expires_at: null,
      status: 'ACTIVE',
    });

    this.logger.log(`Verification Success: user=${userId}`);
    return { success: true };
  }
}
