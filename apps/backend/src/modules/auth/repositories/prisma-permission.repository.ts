import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Permission as PrismaPermission } from '../../../generated/prisma/client';

@Injectable()
export class PrismaPermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(code: string): Promise<PrismaPermission | null> {
    return this.prisma.permission.findUnique({ where: { code } });
  }

  async create(data: {
    code: string;
    name: string;
    description?: string | null;
    module: string;
  }): Promise<PrismaPermission> {
    return this.prisma.permission.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        module: data.module,
      },
    });
  }

  async findMany(): Promise<PrismaPermission[]> {
    return this.prisma.permission.findMany();
  }

  async assignToRole(roleId: string, permissionId: string): Promise<void> {
    // avoid duplicates
    const exists = await this.prisma.rolePermission.findFirst({
      where: { role_id: roleId, permission_id: permissionId },
    });
    if (!exists) {
      await this.prisma.rolePermission.create({
        data: { role_id: roleId, permission_id: permissionId },
      });
    }
  }

  async listPermissionsForRoleId(roleId: string): Promise<PrismaPermission[]> {
    const rps = await this.prisma.rolePermission.findMany({
      where: { role_id: roleId },
      include: { permission: true },
    });
    return rps.map((rp) => rp.permission);
  }

  async revokeFromRole(roleId: string, permissionId: string): Promise<void> {
    await this.prisma.rolePermission.deleteMany({
      where: { role_id: roleId, permission_id: permissionId },
    });
  }
}
