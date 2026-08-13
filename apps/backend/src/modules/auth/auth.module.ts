import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { EmailController } from './controllers/email.controller';
import { AuthService } from './services/auth.service';
import { UsersModule } from '../users/users.module';
import { SecurityModule } from '../../common/security/security.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtConfigService } from '../../config/jwt-config.service';
import type { JwtConfig } from '../../config/jwt.config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { EmailVerificationService } from './services/email-verification.service';
import { PrismaUsersRepository } from '../users/repositories/prisma-users.repository';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../database/prisma.module';
import { PrismaRefreshTokenRepository } from './repositories/prisma-refresh-token.repository';
import { PrismaSessionRepository } from './repositories/prisma-session.repository';
import { PrismaRoleRepository } from './repositories/prisma-role.repository';
import { PrismaPermissionRepository } from './repositories/prisma-permission.repository';
import { RefreshTokensService } from './services/refresh-tokens.service';
import { SessionService } from './services/session.service';
import { SessionsController } from './controllers/sessions.controller';
import { RolesService } from './services/roles.service';
import { PermissionsService } from './services/permissions.service';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    SecurityModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [],
      inject: [JwtConfigService],
      useFactory: (jwtConfig: JwtConfigService) => {
        const cfg: JwtConfig = jwtConfig.config;
        const options: JwtModuleOptions = {
          secret: cfg.secret,
          signOptions: {
            expiresIn: cfg.accessExpiresIn as unknown as number | string,
          },
        } as JwtModuleOptions;
        return options;
      },
    }),
  ],
  controllers: [AuthController, SessionsController, EmailController],
  providers: [
    AuthService,
    JwtStrategy,
    PrismaRefreshTokenRepository,
    PrismaSessionRepository,
    PrismaRoleRepository,
    PrismaPermissionRepository,
    SessionService,
    RolesService,
    PermissionsService,
    RefreshTokensService,
    // Email verification service
    EmailVerificationService,
    // Users repo provider for Auth module internal updates
    PrismaUsersRepository,
    // Rate limiting guard for auth endpoints
    AuthRateLimitGuard,
  ],
  exports: [AuthService, SessionService, RolesService, PermissionsService],
})
export class AuthModule {}
