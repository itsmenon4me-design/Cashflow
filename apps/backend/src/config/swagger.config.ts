import { registerAs } from '@nestjs/config';

export interface SwaggerConfig {
  enabled: boolean;
  title: string;
  description: string;
  version: string;
  path: string;
}

export const swaggerConfig = registerAs<SwaggerConfig>('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED === 'true',
  title: process.env.SWAGGER_TITLE ?? 'CashFlow Enterprise API',
  description:
    process.env.SWAGGER_DESCRIPTION ?? 'CashFlow Enterprise API documentation',
  version: process.env.SWAGGER_VERSION ?? '1.0.0',
  path: process.env.SWAGGER_PATH ?? 'docs',
}));
