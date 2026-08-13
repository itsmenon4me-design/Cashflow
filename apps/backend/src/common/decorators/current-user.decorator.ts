import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!data) {
      return user;
    }
    // Return a specific property if requested (e.g., 'sub', 'role', 'email', 'jti', 'sessionId')
    return user ? (user as any)[data] : undefined;
  },
);
