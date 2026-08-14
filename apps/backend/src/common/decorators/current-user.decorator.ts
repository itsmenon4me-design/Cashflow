import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!data) {
      return user;
    }
    // Return a specific property if requested (e.g., 'sub', 'role', 'email', 'jti', 'sessionId')
    if (!user) return undefined;
    return (user as unknown as Record<string, unknown>)[data];
  },
);
