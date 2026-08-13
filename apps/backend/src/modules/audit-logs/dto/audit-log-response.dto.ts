import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  user_id?: string | null;

  @ApiProperty({ example: 'AUTH_LOGIN' })
  action!: string;

  @ApiProperty({ example: 'auth' })
  module!: string;

  @ApiPropertyOptional({ example: 'User logged in', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ example: 'User', nullable: true })
  entity_type?: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  entity_id?: string | null;

  @ApiPropertyOptional({ example: '192.168.1.10', nullable: true })
  ip_address?: string | null;

  @ApiPropertyOptional({ example: 'Mozilla/5.0 ...', nullable: true })
  user_agent?: string | null;

  @ApiPropertyOptional({ example: 'POST', nullable: true })
  request_method?: string | null;

  @ApiPropertyOptional({ example: '/api/v1/auth/login', nullable: true })
  request_path?: string | null;

  @ApiPropertyOptional({ example: 200, nullable: true })
  response_status?: number | null;

  @ApiPropertyOptional({
    example: { loginMethod: 'password' },
    nullable: true,
  })
  metadata?: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-08-05T08:00:00.000Z' })
  created_at!: string;
}
