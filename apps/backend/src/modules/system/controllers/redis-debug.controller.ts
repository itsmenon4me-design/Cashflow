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
    return this.redisService.debugCheck();
  }
}
