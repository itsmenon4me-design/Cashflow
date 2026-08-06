import { Logger } from '@nestjs/common';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { setupSwagger } from './common/swagger/swagger.setup';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_NAME } from './common/constants/app.constants';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');
  const config = app.get(AppConfigService);

  app.setGlobalPrefix(`${config.apiPrefix}/${config.apiVersion}`);

  app.use(helmet());

  app.enableCors({
    origin: config.corsOrigins,
    methods: config.cors.methods,
    credentials: config.cors.credentials,
  });

  app.use(compression());

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
