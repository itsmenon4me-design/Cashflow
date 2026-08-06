import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionsService } from '../../modules/auth/services/permissions.service';
import { ErrorService } from '../errors/error.service';
import { ErrorCode } from '../errors/error-codes';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);
  constructor(
    private reflector: Reflector,
    private readonly perms: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const rawUser = request.user as unknown;
    if (typeof rawUser !== 'object' || rawUser === null) {
      this.logger.warn('Permission Denied - no user');
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Permission denied');
    }
    const user = rawUser as { sub?: string; role?: string; role_id?: string };
    const roleId = user.role_id;
    const roleCode = user.role;

    if (!roleId && !roleCode) {
      this.logger.warn('Permission Denied - no role info');
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Permission denied');
    }

    // Resolve role id if only code available
    let effectiveRoleId = roleId;
    if (!effectiveRoleId && roleCode) {
      const role = await this.perms.getRoleByCode(roleCode).catch(() => null);
      effectiveRoleId = role?.id;
    }

    if (!effectiveRoleId) {
      this.logger.warn('Permission Denied - unable to resolve role id');
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Permission denied');
    }

    for (const p of required) {
      const ok = await this.perms.roleHasPermission(effectiveRoleId, p);
      if (!ok) {
        this.logger.warn(
          `Permission Denied user=${user.sub ?? 'unknown'} permission=${p}`,
        );
        throw ErrorService.create(ErrorCode.FORBIDDEN, 'Permission denied');
      }
    }

    return true;
  }
}
