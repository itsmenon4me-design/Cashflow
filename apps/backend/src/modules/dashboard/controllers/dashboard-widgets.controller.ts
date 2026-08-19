import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { DashboardWidgetsService } from '../services/dashboard-widgets.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardWidgetsController {
  constructor(private readonly svc: DashboardWidgetsService) {}

  @Get('widgets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get combined dashboard widgets' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'currency', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Dashboard widgets' })
  async getWidgets(
    @CurrentUser('sub') userId: string,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Query('currency') currency?: string,
  ) {
    const month = monthStr ? Number(monthStr) : undefined;
    const year = yearStr ? Number(yearStr) : undefined;
    return this.svc.getWidgets(userId, month, year, currency);
  }
}
