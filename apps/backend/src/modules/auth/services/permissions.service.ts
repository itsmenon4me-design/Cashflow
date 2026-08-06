import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaPermissionRepository } from '../repositories/prisma-permission.repository';
import { PrismaRoleRepository } from '../repositories/prisma-role.repository';

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);
  constructor(
    private readonly repo: PrismaPermissionRepository,
    private readonly roleRepo: PrismaRoleRepository,
  ) {}

  async getRoleByCode(code: string) {
    return this.roleRepo.findByCode(code);
  }

  async onModuleInit(): Promise<void> {
    try {
      // seed default permissions
      const perms: {
        code: string;
        name: string;
        module: string;
        description?: string;
      }[] = [
        // users
        { code: 'users.read', name: 'Read users', module: 'users' },
        { code: 'users.create', name: 'Create users', module: 'users' },
        { code: 'users.update', name: 'Update users', module: 'users' },
        { code: 'users.delete', name: 'Delete users', module: 'users' },
        // accounts
        { code: 'accounts.read', name: 'Read accounts', module: 'accounts' },
        {
          code: 'accounts.create',
          name: 'Create accounts',
          module: 'accounts',
        },
        {
          code: 'accounts.update',
          name: 'Update accounts',
          module: 'accounts',
        },
        {
          code: 'accounts.delete',
          name: 'Delete accounts',
          module: 'accounts',
        },
        // transactions
        {
          code: 'transactions.read',
          name: 'Read transactions',
          module: 'transactions',
        },
        {
          code: 'transactions.create',
          name: 'Create transactions',
          module: 'transactions',
        },
        {
          code: 'transactions.update',
          name: 'Update transactions',
          module: 'transactions',
        },
        {
          code: 'transactions.delete',
          name: 'Delete transactions',
          module: 'transactions',
        },
        // categories
        {
          code: 'categories.read',
          name: 'Read categories',
          module: 'categories',
        },
        {
          code: 'categories.create',
          name: 'Create categories',
          module: 'categories',
        },
        {
          code: 'categories.update',
          name: 'Update categories',
          module: 'categories',
        },
        {
          code: 'categories.delete',
          name: 'Delete categories',
          module: 'categories',
        },
        // dashboard
        { code: 'dashboard.view', name: 'View dashboard', module: 'dashboard' },
        // reports
        { code: 'reports.read', name: 'Read reports', module: 'reports' },
        { code: 'reports.export', name: 'Export reports', module: 'reports' },
      ];

      const created: string[] = [];
      for (const p of perms) {
        const existing = await this.repo.findByCode(p.code);
        if (!existing) {
          await this.repo.create({
            code: p.code,
            name: p.name,
            description: p.description ?? null,
            module: p.module,
          });
          created.push(p.code);
        }
      }

      if (created.length > 0)
        this.logger.log(`Seeded permissions: ${created.join(',')}`);

      // assign all to SUPER_ADMIN
      const superRole = await this.roleRepo.findByCode('SUPER_ADMIN');
      if (superRole) {
        const all = await this.repo.findMany();
        for (const perm of all) {
          await this.repo.assignToRole(superRole.id, perm.id);
        }
        this.logger.log('Assigned all default permissions to SUPER_ADMIN');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Unable to seed permissions: ${msg}`);
    }
  }

  async roleHasPermission(
    roleId: string,
    permissionCode: string,
  ): Promise<boolean> {
    const perms = await this.repo.listPermissionsForRoleId(roleId);
    return perms.some((p) => p.code === permissionCode);
  }
}
