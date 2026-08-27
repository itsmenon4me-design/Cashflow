import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/backend/src/app.module';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { INestApplication } from '@nestjs/common';
import compression from 'compression';
import helmet from 'helmet';
import { AppValidationPipe } from '../apps/backend/src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../apps/backend/src/common/filters/http-exception.filter';
import { setupSwagger } from '../apps/backend/src/common/swagger/swagger.setup';
import { AppConfigService } from '../apps/backend/src/config/app-config.service';

let app: INestApplication | null = null;

async function bootstrap() {
  if (app) return app;

  app = await NestFactory.create(AppModule);

  const config = app.get(AppConfigService);

  app.setGlobalPrefix(`${config.apiPrefix}/${config.apiVersion}`);

  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: config.corsOrigins,
    methods: config.cors.methods,
    credentials: config.cors.credentials,
  });

  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  try {
    setupSwagger(app, config);
  } catch {
    // Swagger optional
  }

  await app.init();

  return app;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const nestApp = await bootstrap();

  const expressApp = nestApp.getHttpAdapter().getInstance();

  return expressApp(req, res);
}