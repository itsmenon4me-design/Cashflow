import type { RefreshTokenEntity } from '../entities/refresh-token.entity';

export interface IRefreshTokenRepository {
  create(data: {
    id?: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    revoked_at?: Date | null;
  }): Promise<RefreshTokenEntity>;
  findById(id: string): Promise<RefreshTokenEntity | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  findByUserId(userId: string): Promise<RefreshTokenEntity[]>;
}
