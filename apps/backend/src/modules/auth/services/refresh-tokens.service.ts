import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtConfigService } from '../../../config/jwt-config.service';
import { PasswordService } from '../../../common/security/password/password.service';
import { PrismaRefreshTokenRepository } from '../repositories/prisma-refresh-token.repository';
import { UsersService } from '../../users/services/users.service';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { SessionService } from './session.service';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import {
  AuditAction,
  AuditEntityType,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';

@Injectable()
export class RefreshTokensService {
  private readonly logger = new Logger(RefreshTokensService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
    private readonly passwordService: PasswordService,
    private readonly repo: PrismaRefreshTokenRepository,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private parseExpiresToSeconds(value: string): number {
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

  async createForUser(userId: string, sessionId: string) {
    const cfg = this.jwtConfig.config;
    const newJti = crypto.randomUUID();
    const refreshPayload = { sub: userId, jti: newJti, sessionId } as Record<
      string,
      unknown
    >;
    const newRefreshToken: string = jwt.sign(
      refreshPayload,
      cfg.refreshSecret,
      {
        expiresIn:
          cfg.refreshExpiresIn as unknown as jwt.SignOptions['expiresIn'],
      },
    );

    const hashed: string =
      await this.passwordService.hashPassword(newRefreshToken);
    const expiresInSeconds = this.parseExpiresToSeconds(
      cfg.refreshExpiresIn ?? '7d',
    );
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await this.repo.create({
      id: newJti,
      user_id: userId,
      token_hash: hashed,
      expires_at: expiresAt,
    });

    return { id: newJti, token: newRefreshToken, expires_at: expiresAt };
  }

  async rotate(refreshTokenRaw: string) {
    // Verify token signature and extract payload
    const cfg = this.jwtConfig.config;
    let payload: Record<string, unknown> | null = null;
    try {
      payload = this.jwtService.verify(refreshTokenRaw, {
        secret: cfg.refreshSecret,
      }) as unknown as Record<string, unknown>;
    } catch {
      this.logger.warn('Invalid refresh token signature');
      throw ErrorService.create(
        ErrorCode.UNAUTHORIZED,
        'Invalid refresh token',
      );
    }

    const jti = (payload && (payload.jti as string)) ?? undefined;
    const sub = (payload && (payload.sub as string)) ?? undefined;
    const sessionId = (payload && (payload.sessionId as string)) ?? undefined;
    if (!jti || !sub) {
      this.logger.warn('Refresh token payload missing required claims');
      throw ErrorService.create(
        ErrorCode.UNAUTHORIZED,
        'Invalid refresh token',
      );
    }

    const stored = await this.repo.findById(jti);
    if (!stored) {
      this.logger.warn('Refresh token not found in storage');
      throw ErrorService.create(
        ErrorCode.UNAUTHORIZED,
        'Invalid refresh token',
      );
    }

    // Check revoked
    if (stored.revoked_at) {
      // possible reuse attempt
      this.logger.warn(
        `Refresh token reuse attempt for user ${stored.user_id}`,
      );
      // revoke all user's tokens to be safe
      await this.repo.revokeAllForUser(stored.user_id);
      throw ErrorService.create(
        ErrorCode.UNAUTHORIZED,
        'Refresh token reuse detected',
      );
    }

    // Check expiry
    if (stored.expires_at.getTime() <= Date.now()) {
      this.logger.warn(`Expired refresh token used for user ${stored.user_id}`);
      throw ErrorService.create(
        ErrorCode.TOKEN_EXPIRED,
        'Refresh token expired',
      );
    }

    // Verify token hash (stored is hash of full token)
    const ok = await this.passwordService.verifyPassword(
      stored.token_hash,
      refreshTokenRaw,
    );
    if (!ok) {
      this.logger.warn(`Invalid refresh token for user ${stored.user_id}`);
      throw ErrorService.create(
        ErrorCode.UNAUTHORIZED,
        'Invalid refresh token',
      );
    }

    // Revoke old token (one-time use)
    await this.repo.revoke(stored.id);

    // Generate new refresh token
    const newJti = crypto.randomUUID();
    const refreshPayload = { sub, jti: newJti, sessionId } as Record<
      string,
      unknown
    >;
    const newRefreshToken: string = jwt.sign(
      refreshPayload,
      cfg.refreshSecret,
      {
        expiresIn:
          cfg.refreshExpiresIn as unknown as jwt.SignOptions['expiresIn'],
      },
    );

    // Hash and store new refresh token
    const hashed: string =
      await this.passwordService.hashPassword(newRefreshToken);
    const expiresInSeconds = this.parseExpiresToSeconds(
      cfg.refreshExpiresIn ?? '7d',
    );
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await this.repo.create({
      id: newJti,
      user_id: sub,
      token_hash: hashed,
      expires_at: expiresAt,
    });

    // Generate new access token. Preserve sessionId from refresh payload if present
    const user = await this.usersService.findById(sub);
    if (!user) {
      this.logger.error(`User not found during refresh: ${sub}`);
      throw ErrorService.create(ErrorCode.UNAUTHORIZED, 'Invalid user');
    }

    const accessJti = crypto.randomUUID();
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role_code ?? 'USER',
      sessionId: sessionId ?? accessJti,
      jti: accessJti,
    } as Record<string, unknown>;
    const accessToken: string = this.jwtService.sign(accessPayload);
    const accessExpires = this.parseExpiresToSeconds(
      this.jwtConfig.config.accessExpiresIn ?? '15m',
    );

    // Update session last activity and refresh_token reference if sessionId present
    if (sessionId) {
      try {
        await this.sessionService.updateLastActivity(sessionId);
        await this.sessionService.updateRefreshToken(
          sessionId,
          newJti,
          expiresAt,
        );
      } catch (err) {
        this.logger.warn(
          `Unable to update session ${sessionId}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`Refresh tokens rotated for user ${user.id}`);

    void this.auditLogService.record({
      userId: user.id,
      action: AuditAction.REFRESH_TOKEN,
      module: AuditModule.AUTHENTICATION,
      entityType: AuditEntityType.USER,
      entityId: user.id,
    });

    return {
      success: true,
      message: 'Token refreshed',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: accessExpires,
      },
    };
  }
}
