import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ErrorService } from '../errors/error.service';
import { ErrorCode } from '../errors/error-codes';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const rawUser = request.user as unknown;
    if (typeof rawUser !== 'object' || rawUser === null) {
      this.logger.warn('Unauthorized Access Attempt - no role present');
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Insufficient role');
    }
    const user = rawUser as { sub?: string; role?: string };
    const roleCode = user.role;
    if (!roleCode) {
      this.logger.warn('Unauthorized Access Attempt - no role present');
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Insufficient role');
    }

    const allowed = requiredRoles.includes(roleCode);
    if (!allowed) {
      const uid = typeof user.sub === 'string' ? user.sub : 'unknown';
      this.logger.warn(
        `Unauthorized Access Attempt user=${uid} required=${requiredRoles.join(',')}`,
      );
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Insufficient role');
    }
    return true;
  }
}
