import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfigService } from '../../config/jwt-config.service';
import { ErrorService } from '../../common/errors/error.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { AuthUser } from '../../common/types/auth-user';
import { SessionService } from './services/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly jwtConfig: JwtConfigService,
    private readonly sessions: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.config.secret,
    });
  }

  async validate(payload: Record<string, unknown>): Promise<AuthUser> {
    // Ensure required claim `sub` is present and valid
    const sub = payload && (payload.sub as string | undefined);
    if (!sub || typeof sub !== 'string' || sub.length === 0) {
      // Passport expects an exception to signal unauthorized
      throw ErrorService.create(ErrorCode.UNAUTHORIZED, 'Invalid token');
    }
    const sessionId = payload.sessionId;
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw ErrorService.create(ErrorCode.UNAUTHORIZED, 'Invalid session');
    }
    if (!(await this.sessions.isAccessSessionActive(sessionId, sub))) {
      throw ErrorService.create(
        ErrorCode.UNAUTHORIZED,
        'Session has been revoked',
      );
    }

    // Build a sanitized AuthUser object, whitelisting allowed claims only.
    const user: AuthUser = {
      sub,
      jti: payload.jti as string | undefined,
      sessionId,
      role: payload.role as string | undefined,
      email: payload.email as string | undefined,
    };

    return user;
  }
}
