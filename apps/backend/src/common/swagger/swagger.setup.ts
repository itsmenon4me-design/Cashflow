import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfigService } from '../../config/app-config.service';
import { StandardErrorResponse } from './dtos/standard-error.dto';
import { StandardSuccessResponse } from './dtos/standard-success.dto';
import { SWAGGER_TAGS } from './swagger.constants';
import { Environment } from '../../config/env.validation';

export function setupSwagger(
  app: INestApplication,
  config: AppConfigService,
): void {
  const env = config.environment;
  const enabled =
    config.swagger.enabled ||
    env === Environment.Development ||
    env === Environment.Test;
  if (!enabled) return;

  const title = config.swagger.title || 'CashFlow Enterprise API';

  const documentBuilder = new DocumentBuilder()
    .setTitle(title)
    .setDescription(
      config.swagger.description || 'Enterprise CashFlow Management System',
    )
    .setVersion(config.swagger.version || 'v1')
    .setTermsOfService('https://example.com/terms')
    .setContact('CashFlow Team', 'https://example.com', 'support@example.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .addServer(
      `${config.url}/${config.apiPrefix}/${config.apiVersion}`,
      'Development server',
    )
    .addServer('https://api.example.com', 'Production server (placeholder)');

  const swaggerDoc = SwaggerModule.createDocument(
    app,
    documentBuilder.build(),
    {
      extraModels: [StandardErrorResponse, StandardSuccessResponse],
    },
  );

  SwaggerModule.setup(
    `/${config.apiPrefix}/${config.apiVersion}/${config.swagger.path}`,
    app,
    swaggerDoc,
    {
      swaggerOptions: {
        persistAuthorization: true,
      },
      customSiteTitle: `${title} Docs`,
    },
  );

  // set tags (for visibility in UI)
  for (const t of SWAGGER_TAGS) {
    swaggerDoc.tags = swaggerDoc.tags || [];
    swaggerDoc.tags.push({ name: t });
  }
}
