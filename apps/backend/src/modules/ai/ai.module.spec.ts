import { Test, TestingModule } from '@nestjs/testing';
import { Global, Module } from '@nestjs/common';
import { AiModule } from './ai.module';
import { AiService } from './services/ai.service';
import { ForecastService } from './services/forecast.service';
import { SpendingPredictionService } from './services/spending-prediction.service';
import { AI_PROVIDER } from './interfaces/ai-provider.interface';
import { SimpleAiProvider } from './providers/simple-ai.provider';
import { AiController } from './controllers/ai.controller';
import { ForecastController } from './controllers/forecast.controller';
import { SpendingPredictionController } from './controllers/spending-prediction.controller';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SecurityConfigService } from '../../config/security-config.service';
import { LoggerService } from '../../common/logger/logger.service';
import { AdminAuditRateLimitGuard } from '../audit-logs/guards/admin-audit-rate-limit.guard';

// AiModule imports CategoriesModule -> AuditLogsModule (global). That module's
// AdminAuditRateLimitGuard injects RedisService, SecurityConfigService and
// LoggerService, none of which is hosted by a module in the isolated test
// graph. This test-only global module supplies test-safe doubles so the real
// dependency graph (guard included) can resolve - same convention as the auth
// controller specs, which pass the same three doubles explicitly.
@Global()
@Module({
  providers: [
    { provide: RedisService, useValue: { incr: jest.fn() } },
    { provide: SecurityConfigService, useValue: {} },
    { provide: LoggerService, useValue: { securityLog: jest.fn() } },
  ],
  exports: [RedisService, SecurityConfigService, LoggerService],
})
class AiTestInfraModule {}

describe('AiModule dependency wiring', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AiModule, AiTestInfraModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('registers every expected service and controller', () => {
    expect(module.get(AiService)).toBeInstanceOf(AiService);
    expect(module.get(ForecastService)).toBeInstanceOf(ForecastService);
    expect(module.get(SpendingPredictionService)).toBeInstanceOf(
      SpendingPredictionService,
    );
    expect(module.get(AiController)).toBeInstanceOf(AiController);
    expect(module.get(ForecastController)).toBeInstanceOf(ForecastController);
    expect(module.get(SpendingPredictionController)).toBeInstanceOf(
      SpendingPredictionController,
    );
  });

  it('binds AI_PROVIDER to a single SimpleAiProvider instance', () => {
    const provider = module.get<SimpleAiProvider>(AI_PROVIDER);

    expect(provider).toBeInstanceOf(SimpleAiProvider);
    expect(provider).toBe(module.get<SimpleAiProvider>(AI_PROVIDER));
  });

  it('resolves services as singletons without duplicate instances', () => {
    expect(module.get(AiService)).toBe(module.get(AiService));
    expect(module.get(ForecastService)).toBe(module.get(ForecastService));
    expect(module.get(SpendingPredictionService)).toBe(
      module.get(SpendingPredictionService),
    );
    expect(module.get(AI_PROVIDER)).toBe(module.get(AI_PROVIDER));
  });

  it('wires the real audit rate-limit guard with test-safe dependencies', () => {
    expect(module.get(AdminAuditRateLimitGuard)).toBeInstanceOf(
      AdminAuditRateLimitGuard,
    );
  });
});
