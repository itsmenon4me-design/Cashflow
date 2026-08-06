import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CashflowAnalyticsService } from '../services/cashflow-analytics.service';
import type { Request } from 'express';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { AnalyticsResponseDto } from '../dto/analytics-response.dto';

type RequestWithUser = Request & { user?: { id?: string } };

@ApiTags('Dashboard')
@Controller('dashboard')
export class AnalyticsController {
  constructor(private readonly service: CashflowAnalyticsService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get cash flow analytics for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Analytics result',
    type: AnalyticsResponseDto,
  })
  async getAnalytics(
    @Req() req: RequestWithUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    const userId = req.user?.id as string;

    let s: Date | undefined;
    let e: Date | undefined;
    if (query.startDate) s = new Date(query.startDate);
    if (query.endDate) e = new Date(query.endDate);

    return this.service.getAnalytics(userId, s, e);
  }
}
