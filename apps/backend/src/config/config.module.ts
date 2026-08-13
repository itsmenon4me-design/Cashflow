import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { AppConfigService } from './app-config.service';
import { CorsConfigService } from './cors-config.service';
import { corsConfig } from './cors.config';
import { DatabaseConfigService } from './database-config.service';
import { databaseConfig } from './database.config';
import { JwtConfigService } from './jwt-config.service';
import { jwtConfig } from './jwt.config';
import { RedisConfigService } from './redis-config.service';
import { redisConfig } from './redis.config';
import { SecurityConfigService } from './security-config.service';
import { securityConfig } from './security.config';
import { SwaggerConfigService } from './swagger-config.service';
import { swaggerConfig } from './swagger.config';
import { validate } from './env.validation';
import { mailConfig } from './mail.config';
import { MailConfigService } from './mail-config.service';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        corsConfig,
        swaggerConfig,
        securityConfig,
        // Auth config
        require('./auth.config').authConfig,
        mailConfig,
      ],
      validate,
      envFilePath: ['.env', `.env.${process.env.NODE_ENV ?? 'development'}`],
    }),
  ],
  providers: [
    AppConfigService,
    DatabaseConfigService,
    RedisConfigService,
    JwtConfigService,
    CorsConfigService,
    SwaggerConfigService,
    SecurityConfigService,
    // Auth config service
    require('./auth-config.service').AuthConfigService,
    MailConfigService,
  ],
  exports: [
    AppConfigService,
    DatabaseConfigService,
    RedisConfigService,
    JwtConfigService,
    CorsConfigService,
    SwaggerConfigService,
    SecurityConfigService,
    require('./auth-config.service').AuthConfigService,
    MailConfigService,
  ],
})
export class ConfigModule {}
