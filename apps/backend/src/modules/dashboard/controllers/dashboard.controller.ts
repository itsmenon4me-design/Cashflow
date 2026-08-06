import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from '../services/dashboard.service';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import type { Request } from 'express';

type RequestWithUser = Request & { user?: { id?: string } };

@ApiTags('Dashboard')
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary returned',
    type: DashboardSummaryResponseDto,
  })
  async getSummary(
    @Req() req: RequestWithUser,
  ): Promise<DashboardSummaryResponseDto> {
    const userId = req.user?.id as string;
    return this.service.getSummaryForUser(userId);
  }
}
