import type { SessionEntity } from '../entities/session.entity';

export interface ISessionRepository {
  create(data: {
    id?: string;
    user_id: string;
    refresh_token_id: string;
    device_name?: string | null;
    device_type?: string | null;
    browser?: string | null;
    operating_system?: string | null;
    ip_address?: string | null;
    city?: string | null;
    country?: string | null;
    user_agent?: string | null;
    last_activity_at: Date;
    expires_at: Date;
    revoked_at?: Date | null;
  }): Promise<SessionEntity>;

  findById(id: string): Promise<SessionEntity | null>;
  findActiveByUserId(userId: string): Promise<SessionEntity[]>;
  revoke(id: string): Promise<void>;
  revokeMany(ids: string[]): Promise<void>;
  revokeAllExcept(userId: string, exceptId?: string): Promise<void>;
  updateLastActivity(id: string, at: Date): Promise<void>;
  updateRefreshToken(
    sessionId: string,
    refreshTokenId: string,
    expiresAt: Date,
  ): Promise<void>;
  updateActivityContext(
    sessionId: string,
    data: {
      ip_address?: string | null;
      city?: string | null;
      country?: string | null;
      user_agent?: string | null;
      device_name?: string | null;
      device_type?: string | null;
      browser?: string | null;
      operating_system?: string | null;
      last_activity_at: Date;
    },
  ): Promise<void>;
}
