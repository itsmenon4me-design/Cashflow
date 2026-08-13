import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { IUsersRepository } from './users.repository.interface';
import { UserEntity } from '../entities/user.entity';
import type {
  User as PrismaUser,
  Role as PrismaRole,
  Prisma,
} from '../../../generated/prisma/client';
import type { UserStatus } from '../entities/user.entity';

type UserWithRole = PrismaUser & {
  role?: PrismaRole | null;
  verification_token_hash?: string | null;
  verification_token_expires_at?: Date | null;
  password_reset_token_hash?: string | null;
  password_reset_expires_at?: Date | null;
  password_reset_requested_at?: Date | null;
};

@Injectable()
export class PrismaUsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(record: UserWithRole): UserEntity {
    const u = new UserEntity();
    u.id = record.id;
    u.created_at = record.created_at;
    u.updated_at = record.updated_at;
    u.deleted_at = record.deleted_at ?? null;
    u.email = record.email;
    u.username = record.username;
    u.full_name = record.full_name;
    u.password_hash = record.password_hash;
    u.avatar_url = record.avatar_url ?? null;
    u.phone_number = record.phone_number ?? null;
    u.status = record.status as UserStatus;
    u.email_verified_at = record.email_verified_at ?? null;
    u.last_login_at = record.last_login_at ?? null;

    u.verification_token_hash = record.verification_token_hash ?? null;
    u.verification_token_expires_at =
      record.verification_token_expires_at ?? null;

    u.password_reset_token_hash = record.password_reset_token_hash ?? null;
    u.password_reset_expires_at = record.password_reset_expires_at ?? null;
    u.password_reset_requested_at = record.password_reset_requested_at ?? null;

    u.role_id = record.role_id ?? null;
    u.role_code = record.role?.code ?? null;
    return u;
  }

  async create(user: Partial<UserEntity>): Promise<UserEntity> {
    const rec = await this.prisma.user.create({
      data: {
        email: user.email as string,
        username: user.username as string,
        full_name: user.full_name as string,
        password_hash: user.password_hash as string,
        status: user.status as UserStatus,
        avatar_url: user.avatar_url ?? null,
        phone_number: user.phone_number ?? null,
        role_id: user.role_id,
      },
      include: { role: true },
    });
    return this.map(rec);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const rec = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!rec) return null;
    if (rec.deleted_at) return null;
    return this.map(rec);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const rec = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!rec) return null;
    if (rec.deleted_at) return null;
    return this.map(rec);
  }

  async update(id: string, updates: Partial<UserEntity>): Promise<UserEntity> {
    // Build a Prisma-compatible update object from allowed fields
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (updates.email !== undefined) data.email = updates.email;
    if (updates.username !== undefined) data.username = updates.username;
    if (updates.full_name !== undefined) data.full_name = updates.full_name;
    if (updates.password_hash !== undefined)
      data.password_hash = updates.password_hash;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.avatar_url !== undefined) data.avatar_url = updates.avatar_url;
    if (updates.phone_number !== undefined)
      data.phone_number = updates.phone_number;
    if (updates.role_id !== undefined) data.role_id = updates.role_id;
    if (updates.email_verified_at !== undefined)
      data.email_verified_at = updates.email_verified_at;
    if (updates.last_login_at !== undefined)
      data.last_login_at = updates.last_login_at;

    if (updates.verification_token_hash !== undefined)
      data.verification_token_hash = updates.verification_token_hash;
    if (updates.verification_token_expires_at !== undefined)
      data.verification_token_expires_at =
        updates.verification_token_expires_at;

    if (updates.password_reset_token_hash !== undefined)
      data.password_reset_token_hash = updates.password_reset_token_hash;
    if (updates.password_reset_expires_at !== undefined)
      data.password_reset_expires_at = updates.password_reset_expires_at;
    if (updates.password_reset_requested_at !== undefined)
      data.password_reset_requested_at = updates.password_reset_requested_at;

    if (updates.deleted_at !== undefined) data.deleted_at = updates.deleted_at;

    const rec = await this.prisma.user.update({
      where: { id },
      data,
      include: { role: true },
    });
    return this.map(rec);
  }

  async count(): Promise<number> {
    const c = await this.prisma.user.count({ where: { deleted_at: null } });
    return c;
  }

  async findAll(): Promise<UserEntity[]> {
    const recs = await this.prisma.user.findMany({
      where: { deleted_at: null },
      include: { role: true },
      orderBy: { created_at: 'desc' },
    });
    return recs.map((r: UserWithRole) => this.map(r));
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
