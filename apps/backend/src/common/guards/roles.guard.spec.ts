import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

describe('RolesGuard', () => {
  const reflector: { getAllAndOverride: jest.Mock } = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  it('allows when no roles metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UNAUTHORIZED when no user', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const ctx = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('throws FORBIDDEN when user without role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const ctx = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u1' } }) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('allows when role present and matches', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const ctx = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'u1', role: 'ADMIN' } }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
