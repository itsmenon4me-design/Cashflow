import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/services/users.service';
import { PasswordService } from '../../../common/security/password/password.service';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { LoginDto } from '../dto/login.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { toUserResponse } from '../../users/mappers/user.mapper';
import { JwtService } from '@nestjs/jwt';
import { JwtConfigService } from '../../../config/jwt-config.service';
import * as crypto from 'crypto';
import { RefreshTokensService } from './refresh-tokens.service';
import { SessionService } from './session.service';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { AuthConfigService } from '../../../config/auth-config.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { RedisService } from '../../../redis/redis.service';
import {
  AuditAction,
  AuditEntityType,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';
import { AuthRequestContext } from '../types/auth-request';
import { deriveDeviceInfo } from './device-info';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
    private readonly refreshService: RefreshTokensService,
    private readonly sessionService: SessionService,
    private readonly auditLogService: AuditLogService,
    private readonly redis: RedisService,
    private readonly authConfig: AuthConfigService,
    private readonly appLogger: LoggerService,
  ) {}

  private parseExpiresToSeconds(value: string): number {
    // supports formats like '15m', '900s', '1h', '7d'
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    const m = value.match(/^(\d+)(s|m|h|d)$/i);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    switch (unit) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
      default:
        return 0;
    }
  }

  async issueSessionForUser(
    user: Awaited<ReturnType<UsersService['findByEmail']>>,
    loginMethod: 'password' | 'google' | 'apple' = 'password',
    context: AuthRequestContext = {},
  ) {
    const jwtCfg = this.jwtConfig.config;
    const jti = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    if (!user) {
      throw ErrorService.create(ErrorCode.UNAUTHORIZED, 'Invalid user');
    }

    const created = await this.refreshService.createForUser(user.id, sessionId);

    await this.sessionService.create({
      id: sessionId,
      user_id: user.id,
      refresh_token_id: created.id,
      ...deriveDeviceInfo(context.userAgent ?? null),
      ip_address: context.ip ?? null,
      city: context.city ?? null,
      country: context.country ?? null,
      user_agent: context.userAgent ?? null,
      last_activity_at: new Date(),
      expires_at: created.expires_at,
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role_code ?? 'USER',
      sessionId,
      jti,
    } as Record<string, unknown>;

    const token = this.jwtService.sign(payload);
    const expiresIn = this.parseExpiresToSeconds(
      jwtCfg.accessExpiresIn || '15m',
    );

    void this.auditLogService.record({
      userId: user.id,
      action: AuditAction.LOGIN,
      module: AuditModule.AUTHENTICATION,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      metadata: { loginMethod },
    });

    return {
      success: true,
      message: 'Login successful',
      data: {
        accessToken: token,
        refreshToken: created.token,
        tokenType: 'Bearer',
        expiresIn,
      },
      user: toUserResponse(user),
    };
  }

  async login(input: LoginDto, context: AuthRequestContext = {}) {
    const user = await this.users.findByEmail(input.email);

    // derive obfuscated identifier key so both existing and non-existing emails behave the same
    const idHash = crypto
      .createHash('sha256')
      .update(input.email.toLowerCase())
      .digest('hex');
    const failKey = `auth:fail:${idHash}`;
    const authCfg = this.authConfig.config;
    const failWindow = authCfg.failWindowSeconds;
    const failLimit = authCfg.failLimit;

    if (!user) {
      // increment failure counter for identifier (best-effort); do not reveal existence
      const cnt = await this.redis.incr(failKey, failWindow);
      if (cnt !== null && cnt >= failLimit) {
        throw ErrorService.create(ErrorCode.RATE_LIMIT);
      }
      throw ErrorService.create(ErrorCode.INVALID_CREDENTIALS);
    }

    // Account status checks
    if (
      user.status === 'INACTIVE' ||
      user.status === 'SUSPENDED' ||
      user.status === 'PENDING_VERIFICATION'
    ) {
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Account not active');
    }

    const ok = await this.passwordService.verifyPassword(
      user.password_hash,
      input.password,
    );
    if (!ok) {
      const cnt = await this.redis.incr(failKey, failWindow);
      if (cnt !== null && cnt >= failLimit) {
        throw ErrorService.create(ErrorCode.RATE_LIMIT);
      }
      throw ErrorService.create(ErrorCode.INVALID_CREDENTIALS);
    }

    // Clear failure counter for this identifier on successful auth (best-effort)
    try {
      await this.redis.del(failKey);
    } catch {
      // ignore — do not fail login if Redis is unavailable
    }

    return this.issueSessionForUser(user, 'password', context);
  }

  async refresh(refreshToken: string, context: AuthRequestContext = {}) {
    return this.refreshService.rotate(refreshToken, context);
  }

  /**
   * Completes a password reset using a single-use token.
   * - Raw token is never stored: it is compared against the stored SHA-256 hash.
   * - Expired / invalid / already-used tokens are rejected with a generic error.
   * - A non-existent user id returns the same success shape as a valid reset
   *   (no user enumeration).
   * - On success the password is re-hashed (Argon2id), the reset state is
   *   cleared (single-use) and all sessions/refresh tokens are revoked.
   */
  async resetPassword(input: ResetPasswordDto): Promise<{
    success: boolean;
    message: string;
  }> {
    const user = await this.users.findById(input.id);
    if (!user) {
      // Do not reveal whether a user exists.
      return { success: true, message: 'Password has been reset successfully' };
    }

    if (!user.password_reset_token_hash || !user.password_reset_expires_at) {
      throw ErrorService.create(
        ErrorCode.INVALID_TOKEN,
        'Invalid or expired password reset token',
      );
    }
    if (user.password_reset_expires_at.getTime() <= Date.now()) {
      throw ErrorService.create(
        ErrorCode.INVALID_TOKEN,
        'Invalid or expired password reset token',
      );
    }

    const provided = Buffer.from(
      crypto.createHash('sha256').update(input.token).digest('hex'),
      'hex',
    );
    const stored = Buffer.from(user.password_reset_token_hash, 'hex');
    if (
      stored.length !== provided.length ||
      !crypto.timingSafeEqual(stored, provided)
    ) {
      throw ErrorService.create(
        ErrorCode.INVALID_TOKEN,
        'Invalid or expired password reset token',
      );
    }

    const hashed = await this.passwordService.hashPassword(input.new_password);

    // Apply new password and clear reset state (single-use) atomically.
    await this.users.applyPasswordReset(user.id, hashed);

    // Terminate all existing sessions/refresh tokens so the reset takes effect.
    await this.sessionService.revokeAllExcept(user.id);

    void this.auditLogService.record({
      userId: user.id,
      action: AuditAction.PASSWORD_CHANGED,
      module: AuditModule.AUTHENTICATION,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      metadata: { method: 'reset-password' },
    });

    return { success: true, message: 'Password has been reset successfully' };
  }

  logout(): { success: true } {
    // Keep for compatibility - real logout is handled in controller
    return { success: true };
  }
}
