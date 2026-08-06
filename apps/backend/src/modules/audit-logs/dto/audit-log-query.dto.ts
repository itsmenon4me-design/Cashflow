import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { AuditAction, AuditModule } from '../constants/audit.constants';

const auditActionValues = Object.values(AuditAction);
const auditModuleValues = Object.values(AuditModule);

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by audit action',
    enum: auditActionValues,
    example: AuditAction.LOGIN,
  })
  @IsOptional()
  @IsString()
  @IsIn(auditActionValues)
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by module',
    enum: auditModuleValues,
    example: AuditModule.AUTHENTICATION,
  })
  @IsOptional()
  @IsString()
  @IsIn(auditModuleValues)
  module?: string;

  @ApiPropertyOptional({
    description: 'Start of the date range (ISO 8601)',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End of the date range (ISO 8601)',
    example: '2026-08-05T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

/**
 * Extracts the repository filter from the validated query DTO.
 */
export function toAuditLogFilter(query: AuditLogQueryDto): {
  userId?: string;
  action?: string;
  module?: string;
  from?: Date;
  to?: Date;
} {
  return {
    userId: query.userId,
    action: query.action,
    module: query.module,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
}
