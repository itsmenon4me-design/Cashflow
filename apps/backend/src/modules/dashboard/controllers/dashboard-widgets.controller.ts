import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { DashboardWidgetsService } from '../services/dashboard-widgets.service';
import type { Request } from 'express';

type RequestWithUser = Request & { user?: { id?: string } };

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardWidgetsController {
  constructor(private readonly svc: DashboardWidgetsService) {}

  @Get('widgets')
  @ApiOperation({ summary: 'Get combined dashboard widgets' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Dashboard widgets' })
  async getWidgets(
    @Req() req: RequestWithUser,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const userId = req.user?.id as string;
    const month = monthStr ? Number(monthStr) : undefined;
    const year = yearStr ? Number(yearStr) : undefined;
    return this.svc.getWidgets(userId, month, year);
  }
}
