import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export const JWT_SECRET_MIN_LENGTH = 32;

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  @IsOptional()
  APP_NAME: string = 'CashFlow Enterprise';

  @IsInt()
  @Min(1)
  @Max(65535)
  APP_PORT: number = 3001;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  HOST: string = '0.0.0.0';

  @IsString()
  @IsOptional()
  APP_URL: string = 'http://localhost:3001';

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api';

  @IsString()
  @IsOptional()
  API_VERSION: string = 'v1';

  @IsString()
  @IsOptional()
  TZ: string = 'Asia/Jakarta';

  @IsString()
  @IsOptional()
  APP_LOCALE: string = 'id-ID';

  @IsString({ message: 'DATABASE_URL must be a string' })
  @IsNotEmpty({ message: 'DATABASE_URL must not be empty' })
  @Matches(/\S/, { message: 'DATABASE_URL must not be whitespace only' })
  DATABASE_URL: string = '';

  @IsString()
  @IsOptional()
  DATABASE_SCHEMA: string = 'public';

  @IsBoolean()
  @IsOptional()
  DATABASE_LOGGING: boolean = false;

  @IsString()
  @IsOptional()
  REDIS_URL: string = '';

  @IsInt()
  @IsOptional()
  REDIS_TTL_SECONDS: number = 60;

  @IsString({ message: 'JWT_SECRET must be a string' })
  @IsNotEmpty({ message: 'JWT_SECRET must not be empty' })
  @Matches(/\S/, { message: 'JWT_SECRET must not be whitespace only' })
  @MinLength(JWT_SECRET_MIN_LENGTH, {
    message: `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`,
  })
  JWT_SECRET: string = '';

  @IsString({ message: 'JWT_REFRESH_SECRET must be a string' })
  @IsNotEmpty({ message: 'JWT_REFRESH_SECRET must not be empty' })
  @Matches(/\S/, { message: 'JWT_REFRESH_SECRET must not be whitespace only' })
  @MinLength(JWT_SECRET_MIN_LENGTH, {
    message: `JWT_REFRESH_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`,
  })
  JWT_REFRESH_SECRET: string = '';

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  JWT_ALGORITHM: string = 'HS256';

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:3000';

  @IsBoolean()
  @IsOptional()
  CORS_CREDENTIALS: boolean = true;

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'debug';

  @IsBoolean()
  @IsOptional()
  SWAGGER_ENABLED: boolean = false;

  @IsString()
  @IsOptional()
  SWAGGER_TITLE: string = 'CashFlow Enterprise API';

  @IsString()
  @IsOptional()
  SWAGGER_DESCRIPTION: string = 'CashFlow Enterprise API documentation';

  @IsString()
  @IsOptional()
  SWAGGER_VERSION: string = '1.0.0';

  @IsString()
  @IsOptional()
  SWAGGER_PATH: string = 'docs';

  @IsBoolean()
  @IsOptional()
  SECURITY_HELMET: boolean = true;

  @IsBoolean()
  @IsOptional()
  SECURITY_CORS: boolean = true;

  @IsBoolean()
  @IsOptional()
  RATE_LIMIT_ENABLED: boolean = false;

  @IsInt()
  @IsOptional()
  RATE_LIMIT_TTL_SECONDS: number = 60;

  @IsInt()
  @IsOptional()
  RATE_LIMIT_LIMIT: number = 100;

  @IsInt()
  @IsOptional()
  AUDIT_ADMIN_RATE_LIMIT_TTL_SECONDS: number = 60;

  @IsInt()
  @IsOptional()
  AUDIT_ADMIN_RATE_LIMIT_LIMIT: number = 120;

  @IsBoolean()
  @IsOptional()
  SECURE_COOKIES: boolean = false;

  // SMTP / Mail settings
  @IsString()
  @IsOptional()
  SMTP_HOST: string = '';

  @IsInt()
  @IsOptional()
  SMTP_PORT: number = 587;

  @IsString()
  @IsOptional()
  SMTP_USER: string = '';

  @IsString()
  @IsOptional()
  SMTP_PASSWORD: string = '';

  @IsString()
  @IsOptional()
  SMTP_FROM: string = 'no-reply@cashflow.example.com';

  @IsBoolean()
  @IsOptional()
  EMAIL_VERIFICATION_ENABLED: boolean = false;

  @IsBoolean()
  @IsOptional()
  PASSWORD_RESET_ENABLED: boolean = true;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed: ${errors
        .map((error) => Object.values(error.constraints ?? {}).join(', '))
        .join('; ')}`,
    );
  }

  return validatedConfig;
}
