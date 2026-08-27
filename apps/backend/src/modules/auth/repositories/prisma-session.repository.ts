import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ISessionRepository } from './session.repository.interface';
import { SessionEntity } from '../entities/session.entity';
import type { Session as PrismaSession } from '../../../generated/prisma/client';

@Injectable()
export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: PrismaSession): SessionEntity {
    const e = new SessionEntity();
    e.id = rec.id;
    e.user_id = rec.user_id;
    e.refresh_token_id = rec.refresh_token_id;
    e.device_name = rec.device_name ?? null;
    e.device_type = rec.device_type ?? null;
    e.browser = rec.browser ?? null;
    e.operating_system = rec.operating_system ?? null;
    e.ip_address = rec.ip_address ?? null;
    e.city = rec.city ?? null;
    e.country = rec.country ?? null;
    e.user_agent = rec.user_agent ?? null;
    e.last_activity_at = rec.last_activity_at;
    e.expires_at = rec.expires_at;
    e.revoked_at = rec.revoked_at ?? null;
    e.created_at = rec.created_at;
    e.updated_at = rec.updated_at;
    return e;
  }

  async create(data: {
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
  }): Promise<SessionEntity> {
    const rec = await this.prisma.session.create({
      data: {
        id: data.id,
        user_id: data.user_id,
        refresh_token_id: data.refresh_token_id,
        device_name: data.device_name,
        device_type: data.device_type,
        browser: data.browser,
        operating_system: data.operating_system,
        ip_address: data.ip_address,
        city: data.city,
        country: data.country,
        user_agent: data.user_agent,
        last_activity_at: data.last_activity_at,
        expires_at: data.expires_at,
        revoked_at: data.revoked_at,
      },
    });
    return this.map(rec);
  }

  async findById(id: string): Promise<SessionEntity | null> {
    const rec = await this.prisma.session.findUnique({ where: { id } });
    if (!rec) return null;
    return this.map(rec);
  }

  async findActiveByUserId(userId: string): Promise<SessionEntity[]> {
    const recs = await this.prisma.session.findMany({
      where: { user_id: userId, revoked_at: null, expires_at: { gt: new Date() } },
      orderBy: { last_activity_at: 'desc' },
    });
    return recs.map((r: PrismaSession) => this.map(r));
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { revoked_at: new Date() },
    });
  }

  async revokeMany(ids: string[]): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: { in: ids } },
      data: { revoked_at: new Date() },
    });
  }

  async revokeAllExcept(userId: string, exceptId?: string): Promise<void> {
    if (exceptId) {
      await this.prisma.session.updateMany({
        where: { user_id: userId, revoked_at: null, id: { not: exceptId } },
        data: { revoked_at: new Date() },
      });
    } else {
      await this.prisma.session.updateMany({
        where: { user_id: userId, revoked_at: null, expires_at: { gt: new Date() } },
        data: { revoked_at: new Date() },
      });
    }
  }

  async updateLastActivity(id: string, at: Date): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { last_activity_at: at },
    });
  }

  async updateRefreshToken(
    sessionId: string,
    refreshTokenId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { refresh_token_id: refreshTokenId, expires_at: expiresAt },
    });
  }

  async updateActivityContext(
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
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        ...data,
        ip_address: data.ip_address,
        city: data.city,
        country: data.country,
        user_agent: data.user_agent,
        device_name: data.device_name,
        device_type: data.device_type,
        browser: data.browser,
        operating_system: data.operating_system,
        last_activity_at: data.last_activity_at,
      },
    });
  }
}
