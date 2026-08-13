import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Audit } from '../../../common/audit/audit.decorator';
import { AdminAuditRateLimitGuard } from '../guards/admin-audit-rate-limit.guard';
import {
  AuditAction,
  AuditEntityType,
  AuditModule,
} from '../constants/audit.constants';
import { AuditLogsService } from '../services/audit-logs.service';
import { AuditLogQueryDto, toAuditLogFilter } from '../dto/audit-log-query.dto';
import { AuditLogResponseDto } from '../dto/audit-log-response.dto';
import { toAuditLogResponse } from '../mappers/audit-log.mapper';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationHelper } from '../../../common/utils/pagination.util';

function stripUserId(
  filter: import('../interfaces/audit-log.interface').AuditLogFilter,
): Omit<import('../interfaces/audit-log.interface').AuditLogFilter, 'userId'> {
  return {
    action: filter.action,
    module: filter.module,
    from: filter.from,
    to: filter.to,
  };
}

@ApiTags('Audit Logs')
@ApiBearerAuth('jwt')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'List own audit logs (authenticated user only)',
    description:
      'Returns the audit entries of the authenticated user, scoped to req.user.sub. Supports filtering by action, module and date range.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'module', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Paginated own audit logs',
    type: [AuditLogResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async myList(@CurrentUser('sub') userId: string, @Query() query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { items, total } = await this.auditLogs.findOwnByUser(
      userId,
      stripUserId(toAuditLogFilter(query)),
      { page, limit },
    );
    return {
      success: true,
      message: 'Success',
      data: items.map((e) => toAuditLogResponse(e)),
      meta: PaginationHelper.buildMeta(page, limit, total),
    };
  }

  @Get('me/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get own audit log by id (authenticated user only)',
  })
  @ApiParam({ name: 'id', description: 'Audit log id (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Audit log detail',
    type: AuditLogResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async myFindOne(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const entry = await this.auditLogs.findOwnById(userId, id);
    return {
      success: true,
      message: 'Success',
      data: toAuditLogResponse(entry),
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, AdminAuditRateLimitGuard)
  @Roles('SUPER_ADMIN')
  @Audit(AuditAction.AUDIT_VIEW, AuditModule.AUDIT, AuditEntityType.AUDIT_LOG)
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
  @UseGuards(JwtAuthGuard, RolesGuard, AdminAuditRateLimitGuard)
  @Roles('SUPER_ADMIN')
  @Audit(AuditAction.AUDIT_VIEW, AuditModule.AUDIT, AuditEntityType.AUDIT_LOG)
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
  async findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<{
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
