import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfigService } from '../../config/jwt-config.service';
import { ErrorService } from '../../common/errors/error.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { AuthUser } from '../../common/types/auth-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly jwtConfig: JwtConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.config.secret,
    });
  }

  validate(payload: Record<string, unknown>): AuthUser {
    // Ensure required claim `sub` is present and valid
    const sub = payload && (payload.sub as string | undefined);
    if (!sub || typeof sub !== 'string' || sub.length === 0) {
      // Passport expects an exception to signal unauthorized
      throw ErrorService.create(ErrorCode.UNAUTHORIZED, 'Invalid token');
    }

    // Build a sanitized AuthUser object, whitelisting allowed claims only.
    const user: AuthUser = {
      sub,
      jti: payload.jti as string | undefined,
      sessionId: payload.sessionId as string | undefined,
      role: payload.role as string | undefined,
      email: payload.email as string | undefined,
    };

    return user;
  }
}
