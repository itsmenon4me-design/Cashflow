import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from '../services/health.service';
import { HealthResponseDto } from '../dto/health-response.dto';

@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full health check' })
  @ApiResponse({
    status: 200,
    description: 'Health response',
    type: HealthResponseDto,
  })
  async health(): Promise<HealthResponseDto> {
    return this.healthService.getHealth();
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Liveness ok' })
  async live(): Promise<{ success: boolean; status: string }> {
    const ok = await this.healthService.isAlive();
    return { success: ok, status: ok ? 'healthy' : 'unhealthy' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async ready(): Promise<any> {
    const ok = await this.healthService.isReady();
    if (ok) return { success: true, status: 'healthy' };
    return {
      success: false,
      status: 'unhealthy',
    };
  }
}
