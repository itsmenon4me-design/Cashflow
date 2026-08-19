import { Logger } from '@nestjs/common';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { setupSwagger } from './common/swagger/swagger.setup';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import type { Express } from 'express';
import { AppModule } from './app.module';
import { APP_NAME } from './common/constants/app.constants';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfigService } from './config/app-config.service';

// Allow BigInt fields (amount_cents) to be serialized as JSON strings.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
  this: bigint,
): string {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');
  const config = app.get(AppConfigService);

  app.setGlobalPrefix(`${config.apiPrefix}/${config.apiVersion}`);

  app.use(helmet());

  const allowedOrigins =
    config.corsOrigins.length > 0
      ? config.corsOrigins
      : process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
        ? []
        : [
            'http://localhost:3000',
            'http://localhost:3002',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3002',
          ];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean | string) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed = allowedOrigins.includes(origin);
      callback(null, isAllowed ? origin : false);
    },
    methods: config.cors.methods,
    credentials: config.cors.credentials,
  });

  app.use(compression());

  // Trust proxy configuration: respect SECURITY.trustProxy to avoid blind trust of X-Forwarded-* headers
  // When true, app will trust upstream (e.g., Nginx) and use forwarded IPs; keep false for local development
  // `app` is an INestApplication whose underlying platform exposes Express APIs when using the default adapter.
  const expressAdapter = app.getHttpAdapter().getInstance() as Express;
  expressAdapter.set('trust proxy', config.security.trustProxy);

  // Global validation pipe configured for the application
  // Use the centralized AppValidationPipe to ensure consistent error format and transformations
  app.useGlobalPipes(new AppValidationPipe());

  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger setup
  try {
    setupSwagger(app, config);
  } catch (e) {
    logger.warn('Swagger setup skipped: ' + String(e));
  }

  await app.listen(config.port, config.host);

  logger.log(
    `${APP_NAME} is running on http://${config.host}:${config.port}/${config.apiPrefix}/${config.apiVersion}`,
  );
}

void bootstrap();
