import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaRoleRepository } from '../repositories/prisma-role.repository';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);
  constructor(private readonly repo: PrismaRoleRepository) {}

  async onModuleInit(): Promise<void> {
    try {
      const r = await this.repo.ensureSuperAdmin();
      this.logger.log(`Ensured role exists: ${r.code}`);
    } catch (err) {
      this.logger.warn(
        `Unable to ensure SUPER_ADMIN role: ${(err as Error).message}`,
      );
    }
  }

  async getByCode(code: string) {
    return this.repo.findByCode(code);
  }
}
