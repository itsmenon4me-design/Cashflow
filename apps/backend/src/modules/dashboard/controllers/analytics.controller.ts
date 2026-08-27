import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CashflowAnalyticsService } from '../services/cashflow-analytics.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { AnalyticsResponseDto } from '../dto/analytics-response.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class AnalyticsController {
  constructor(private readonly service: CashflowAnalyticsService) {}

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get cash flow analytics for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Analytics result',
    type: AnalyticsResponseDto,
  })
  async getAnalytics(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    let s: Date | undefined;
    let e: Date | undefined;
    if (query.startDate) s = new Date(query.startDate);
    if (query.endDate) e = new Date(query.endDate);

    return this.service.getAnalytics(userId, s, e);
  }
}
