import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { HealthService } from './services/health.service';
import { PrismaModule } from '../../database/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { LoggerModule } from '../../common/logger/logger.module';
import { ConfigModule } from '../../config/config.module';
import { RedisDebugController } from './controllers/redis-debug.controller';

@Module({
  imports: [PrismaModule, RedisModule, LoggerModule, ConfigModule],
  controllers: [HealthController, RedisDebugController],
  providers: [HealthService],
  exports: [HealthService],
})
export class SystemModule {}
