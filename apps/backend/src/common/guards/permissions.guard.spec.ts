import { PermissionsGuard } from './permissions.guard';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../../modules/auth/services/permissions.service';
import { ExecutionContext } from '@nestjs/common';

describe('PermissionsGuard', () => {
  const permsService: {
    getRoleByCode: jest.Mock;
    roleHasPermission: jest.Mock;
  } = {
    getRoleByCode: jest.fn(),
    roleHasPermission: jest.fn(),
  };
  const reflector: { getAllAndOverride: jest.Mock } = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new PermissionsGuard(
    reflector as unknown as Reflector,
    permsService as unknown as PermissionsService,
  );

  it('allows when no permissions metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws UNAUTHORIZED when no user', async () => {
    reflector.getAllAndOverride.mockReturnValue(['transactions.read']);
    const ctx = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toBeDefined();
  });

  it('throws FORBIDDEN when no role info', async () => {
    reflector.getAllAndOverride.mockReturnValue(['transactions.read']);
    const ctx = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u1' } }) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toBeDefined();
  });

  it('resolves role by code and checks permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['transactions.read']);
    permsService.getRoleByCode.mockResolvedValue({ id: 'r1' });
    permsService.roleHasPermission.mockResolvedValue(true);
    const ctx = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'u1', role: 'USER' } }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
