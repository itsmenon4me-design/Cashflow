import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuditLogsService } from '../services/audit-logs.service';
import { AuditLogQueryDto, toAuditLogFilter } from '../dto/audit-log-query.dto';
import { AuditLogResponseDto } from '../dto/audit-log-response.dto';
import { toAuditLogResponse } from '../mappers/audit-log.mapper';
import { PaginationHelper } from '../../../common/utils/pagination.util';

@ApiTags('Audit Logs')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'List audit logs (SUPER_ADMIN only)',
    description:
      'Returns paginated audit entries. Supports filtering by user, action, module and date range.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated audit logs',
    type: [AuditLogResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  async list(@Query() query: AuditLogQueryDto): Promise<{
    success: boolean;
    message: string;
    data: AuditLogResponseDto[];
    meta: import('../../../common/interfaces/api-response.interface').PaginationMeta;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { items, total } = await this.auditLogs.findMany(
      toAuditLogFilter(query),
      { page, limit },
    );
    return {
      success: true,
      message: 'Success',
      data: items.map((e) => toAuditLogResponse(e)),
      meta: PaginationHelper.buildMeta(page, limit, total),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get audit log by id (SUPER_ADMIN only)',
  })
  @ApiParam({ name: 'id', description: 'Audit log id (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Audit log detail',
    type: AuditLogResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async findOne(@Param('id') id: string): Promise<{
    success: boolean;
    message: string;
    data: AuditLogResponseDto;
  }> {
    const entry = await this.auditLogs.findById(id);
    return {
      success: true,
      message: 'Success',
      data: toAuditLogResponse(entry),
    };
  }
}
