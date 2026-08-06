import { Injectable, Logger } from '@nestjs/common';
import type { ISessionRepository } from '../repositories/session.repository.interface';
import type { IRefreshTokenRepository } from '../repositories/refresh-token.repository.interface';
import { SessionEntity } from '../entities/session.entity';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly repo: ISessionRepository,
    private readonly refreshRepo: IRefreshTokenRepository,
  ) {}

  async create(data: {
    id?: string;
    user_id: string;
    refresh_token_id: string;
    device_name?: string | null;
    device_type?: string | null;
    browser?: string | null;
    operating_system?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    last_activity_at: Date;
    expires_at: Date;
  }): Promise<SessionEntity> {
    const session = await this.repo.create({
      id: data.id,
      user_id: data.user_id,
      refresh_token_id: data.refresh_token_id,
      device_name: data.device_name,
      device_type: data.device_type,
      browser: data.browser,
      operating_system: data.operating_system,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      last_activity_at: data.last_activity_at,
      expires_at: data.expires_at,
    });
    this.logger.log(
      `Session Created for user ${data.user_id} session=${session.id}`,
    );
    return session;
  }

  async listForUser(userId: string): Promise<SessionEntity[]> {
    return this.repo.findActiveByUserId(userId);
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    const s = await this.repo.findById(sessionId);
    if (!s || s.user_id !== userId) return; // silently ignore to avoid leaking
    await this.repo.revoke(sessionId);
    // revoke refresh token as well
    await this.refreshRepo.revoke(s.refresh_token_id);
    this.logger.log(`Session Revoked user=${userId} session=${sessionId}`);
  }

  async revokeAllExcept(userId: string, exceptId?: string): Promise<void> {
    // find active sessions for user
    const active = await this.repo.findActiveByUserId(userId);
    const toRevoke = active.filter((s) => s.id !== exceptId);
    const ids = toRevoke.map((s) => s.id);
    const refreshIds = toRevoke.map((s) => s.refresh_token_id);
    if (ids.length > 0) {
      await this.repo.revokeMany(ids);
    }
    // revoke refresh tokens
    for (const rid of refreshIds) {
      await this.refreshRepo.revoke(rid);
    }
    this.logger.log(
      `Logout All Devices for user=${userId} except=${exceptId ?? 'none'}`,
    );
  }

  async logoutCurrent(sessionId: string, userId: string): Promise<void> {
    await this.revoke(sessionId, userId);
    this.logger.log(`Logout user=${userId} session=${sessionId}`);
  }

  async updateLastActivity(sessionId: string): Promise<void> {
    await this.repo.updateLastActivity(sessionId, new Date());
  }

  async updateRefreshToken(
    sessionId: string,
    refreshTokenId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.repo.updateRefreshToken(sessionId, refreshTokenId, expiresAt);
  }
}
