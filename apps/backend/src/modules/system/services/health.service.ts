import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { AppConfigService } from '../../../config/app-config.service';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
    private readonly config: AppConfigService,
  ) {}

  private async checkDatabase(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number | null;
  }> {
    const start = Date.now();
    try {
      // Simple connectivity check
      // Use a lightweight query to measure latency
      // $queryRaw returns an array/object depending on driver; use $queryRawUnsafe for portability
      // Note: If Prisma is not connected, this will throw
      // Use Prisma tagged template for a safe raw query

      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (err) {
      const latency = Date.now() - start;
      this.logger.warn('Database health check failed', 'HEALTH', {
        latency,
        error: String(err),
      });
      return { status: 'unhealthy', latency };
    }
  }

  private async checkRedis(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number | null;
  }> {
    const start = Date.now();
    try {
      const ok = await this.redis.ping();
      const latency = Date.now() - start;
      return { status: ok ? 'healthy' : 'unhealthy', latency };
    } catch (err) {
      const latency = Date.now() - start;
      this.logger.warn('Redis health check failed', 'HEALTH', {
        latency,
        error: String(err),
      });
      return { status: 'unhealthy', latency };
    }
  }

  async getHealth(): Promise<{
    success: boolean;
    status: 'healthy' | 'unhealthy';
    application: string;
    version: string;
    environment: string;
    uptime: number;
    timestamp: string;
    checks: {
      database: { status: 'healthy' | 'unhealthy'; latency: number | null };
      redis: { status: 'healthy' | 'unhealthy'; latency: number | null };
    };
  }> {
    const [db, rd] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const overallStatus =
      db.status === 'healthy' && rd.status === 'healthy'
        ? 'healthy'
        : 'unhealthy';

    // Log unhealthy dependencies
    if (db.status === 'unhealthy') {
      this.logger.error('Database dependency unhealthy', undefined, 'HEALTH', {
        latency: db.latency,
      });
    }
    if (rd.status === 'unhealthy') {
      this.logger.error('Redis dependency unhealthy', undefined, 'HEALTH', {
        latency: rd.latency,
      });
    }

    return {
      success: overallStatus === 'healthy',
      status: overallStatus,
      application: this.config.name,
      version: this.config.apiVersion,
      environment: this.config.environment,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks: {
        database: db,
        redis: rd,
      },
    };
  }

  async isReady(): Promise<boolean> {
    const db = await this.checkDatabase();
    const rd = await this.checkRedis();
    return db.status === 'healthy' && rd.status === 'healthy';
  }

  isAlive(): Promise<boolean> {
    // If process is running, it's alive — keep lightweight and return a resolved promise
    return Promise.resolve(true);
  }
}
