import { ApiProperty } from '@nestjs/swagger';

class HealthDetailDto {
  @ApiProperty({ enum: ['healthy', 'unhealthy'] })
  status: 'healthy' | 'unhealthy';

  @ApiProperty({
    required: false,
    type: 'number',
    description: 'Latency in ms',
  })
  latency?: number | null;
}

export class HealthResponseDto {
  @ApiProperty({ description: 'Indicates overall success' })
  success: boolean;

  @ApiProperty({ enum: ['healthy', 'unhealthy'] })
  status: 'healthy' | 'unhealthy';

  @ApiProperty({ description: 'Application name' })
  application: string;

  @ApiProperty({ description: 'Application version' })
  version: string;

  @ApiProperty({ description: 'Runtime environment' })
  environment: string;

  @ApiProperty({ description: 'Uptime in seconds' })
  uptime: number;

  @ApiProperty({ description: 'Current timestamp' })
  timestamp: string;

  @ApiProperty({ description: 'Checks details', type: Object })
  checks: {
    database: HealthDetailDto;
    redis: HealthDetailDto;
  };
}
