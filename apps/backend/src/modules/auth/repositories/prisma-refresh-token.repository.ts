import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { IRefreshTokenRepository } from './refresh-token.repository.interface';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';
import type { RefreshToken as PrismaRefreshToken } from '@prisma/client';

@Injectable()
export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: PrismaRefreshToken): RefreshTokenEntity {
    const e = new RefreshTokenEntity();
    e.id = rec.id;
    e.user_id = rec.user_id;
    e.token_hash = rec.token_hash;
    e.expires_at = rec.expires_at;
    e.revoked_at = rec.revoked_at ?? null;
    e.created_at = rec.created_at;
    e.updated_at = rec.updated_at;
    return e;
  }

  async create(data: {
    id?: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    revoked_at?: Date | null;
  }): Promise<RefreshTokenEntity> {
    const rec = await this.prisma.refreshToken.create({
      data: {
        id: data.id,
        user_id: data.user_id,
        token_hash: data.token_hash,
        expires_at: data.expires_at,
        revoked_at: data.revoked_at,
      },
    });
    return this.map(rec);
  }

  async findById(id: string): Promise<RefreshTokenEntity | null> {
    const rec = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!rec) return null;
    return this.map(rec);
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revoked_at: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async findByUserId(userId: string): Promise<RefreshTokenEntity[]> {
    const recs = await this.prisma.refreshToken.findMany({
      where: { user_id: userId },
    });
    return recs.map((r: PrismaRefreshToken) => this.map(r));
  }
}
