import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../errors/error-codes';

describe('RolesGuard', () => {
  const reflector: any = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector);

  it('allows when no roles metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx: any = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({}) }),
    };
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UNAUTHORIZED when no user', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const ctx: any = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({}) }),
    };
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('throws FORBIDDEN when user without role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const ctx: any = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u1' } }) }),
    };
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  it('allows when role present and matches', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const ctx: any = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'u1', role: 'ADMIN' } }),
      }),
    };
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
