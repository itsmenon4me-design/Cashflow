import { PermissionsGuard } from './permissions.guard';
import { Reflector } from '@nestjs/core';

describe('PermissionsGuard', () => {
  const permsService: any = {
    getRoleByCode: jest.fn(),
    roleHasPermission: jest.fn(),
  };
  const reflector: any = { getAllAndOverride: jest.fn() };
  const guard = new PermissionsGuard(reflector, permsService);

  it('allows when no permissions metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx: any = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({}) }),
    };
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws UNAUTHORIZED when no user', async () => {
    reflector.getAllAndOverride.mockReturnValue(['transactions.read']);
    const ctx: any = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({}) }),
    };
    await expect(guard.canActivate(ctx)).rejects.toBeDefined();
  });

  it('throws FORBIDDEN when no role info', async () => {
    reflector.getAllAndOverride.mockReturnValue(['transactions.read']);
    const ctx: any = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u1' } }) }),
    };
    await expect(guard.canActivate(ctx)).rejects.toBeDefined();
  });

  it('resolves role by code and checks permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['transactions.read']);
    permsService.getRoleByCode.mockResolvedValue({ id: 'r1' });
    permsService.roleHasPermission.mockResolvedValue(true);
    const ctx: any = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'u1', role: 'USER' } }),
      }),
    };
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
