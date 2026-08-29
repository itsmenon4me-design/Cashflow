import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RoleEntity } from '../entities/role.entity';
import type { Role as PrismaRole } from '../../../generated/prisma/client';

@Injectable()
export class PrismaRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: PrismaRole): RoleEntity {
    const e = new RoleEntity();
    e.id = rec.id;
    e.code = rec.code;
    e.name = rec.name;
    e.description = rec.description ?? null;
    e.is_system = rec.is_system;
    e.created_at = rec.created_at;
    e.updated_at = rec.updated_at;
    return e;
  }

  async findByCode(code: string): Promise<RoleEntity | null> {
    const rec = await this.prisma.role.findUnique({ where: { code } });
    if (!rec) return null;
    return this.map(rec);
  }

  async create(data: {
    code: string;
    name: string;
    description?: string | null;
    is_system?: boolean;
  }): Promise<RoleEntity> {
    const rec = await this.prisma.role.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        is_system: data.is_system ?? false,
      },
    });
    return this.map(rec);
  }

  async ensureSuperAdmin(): Promise<RoleEntity> {
    const existing = await this.findByCode('SUPER_ADMIN');
    if (existing) return existing;
    return this.create({
      code: 'SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'Default system super admin role',
      is_system: true,
    });
  }

  async ensureDefaultRole(): Promise<RoleEntity> {
    const userRole = await this.findByCode('USER');
    if (userRole) return userRole;
    return this.ensureSuperAdmin();
  }

  async listPermissionCodes(roleId: string): Promise<string[]> {
    const rps = await this.prisma.rolePermission.findMany({
      where: { role_id: roleId },
      include: { permission: true },
    });
    return rps.map((rp) => rp.permission.code);
  }
}
