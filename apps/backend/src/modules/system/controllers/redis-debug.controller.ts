import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RedisService } from '../../../redis/redis.service';

@ApiTags('Debug')
@Controller('debug/redis-check')
export class RedisDebugController {
  constructor(private readonly redisService: RedisService) {}

  // TODO: Remove or disable this unauthenticated diagnostic endpoint after Redis production debugging.
  @Get()
  @ApiOperation({ summary: 'Temporary Redis connectivity diagnostic' })
  async checkRedis() {
    const result = await this.redisService.debugCheck();
    const redisEnvironment = Object.keys(process.env)
      .filter((key) => key.toUpperCase().includes('REDIS'))
      .sort()
      .map((key) => ({
        key,
        value:
          /PASSWORD|SECRET|TOKEN/i.test(key) || key === 'REDIS_URL'
            ? '[redacted]'
            : process.env[key],
        valueJson:
          /PASSWORD|SECRET|TOKEN/i.test(key) || key === 'REDIS_URL'
            ? '[redacted]'
            : JSON.stringify(process.env[key]),
      }));

    return {
      ...result,
      rawEnvironment: {
        REDIS_HOST: this.rawValue(process.env.REDIS_HOST),
        REDIS_PORT: this.rawValue(process.env.REDIS_PORT),
        REDIS_TLS: this.rawValue(process.env.REDIS_TLS),
        redisKeys: redisEnvironment,
      },
    };
  }

  private rawValue(value: string | undefined) {
    return {
      state: value === undefined ? 'undefined' : value === '' ? 'empty' : 'set',
      value: value ?? null,
      valueJson: JSON.stringify(value),
      hasLeadingWhitespace: value !== undefined && value !== value.trimStart(),
      hasTrailingWhitespace: value !== undefined && value !== value.trimEnd(),
    };
  }
}
