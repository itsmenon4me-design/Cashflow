import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AnalyticsService } from '../services/analytics.service';
import type { AnalyticsRangeQuery } from '../services/analytics.service';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { DateHelper } from '../../../common/utils/date.util';
import { resolveUserTimezone } from '../../../common/utils/user-timezone.util';
import { PrismaService } from '../../../database/prisma.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class AnalyticsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  private async resolveQuery(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsRangeQuery> {
    const timeZone = await resolveUserTimezone(this.prisma, userId);
    const parseBoundary = (value: string, boundary: 'start' | 'end') => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return boundary === 'start'
          ? DateHelper.startOfDayInTimezone(value, timeZone)
          : DateHelper.endOfDayInTimezone(value, timeZone);
      }

      const instant = new Date(value);
      if (Number.isNaN(instant.getTime())) {
        throw new BadRequestException(`Invalid ${boundary} date`);
      }
      return instant;
    };
    const startDate = parseBoundary(query.startDate, 'start');
    const endDate = parseBoundary(query.endDate, 'end');

    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return { ...query, startDate, endDate, timeZone };
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Financial overview for a period (income, expense, saving rate)',
  })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Financial overview' })
  async overview(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.overview(userId, await this.resolveQuery(userId, query));
  }

  @Get('income')
  @ApiOperation({ summary: 'Income analytics (total, trend, categories, top)' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
  })
  @ApiResponse({ status: 200, description: 'Income analytics' })
  async income(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.income(userId, await this.resolveQuery(userId, query));
  }

  @Get('expenses')
  @ApiOperation({
    summary: 'Expense analytics (total, trend, categories, top)',
  })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
  })
  @ApiResponse({ status: 200, description: 'Expense analytics' })
  async expenses(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.expenses(userId, await this.resolveQuery(userId, query));
  }

  @Get('cashflow')
  @ApiOperation({
    summary: 'Cash flow analytics (trend, surplus/deficit periods)',
  })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
  })
  @ApiResponse({ status: 200, description: 'Cash flow analytics' })
  async cashflow(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.cashflow(userId, await this.resolveQuery(userId, query));
  }

  @Get('spending')
  @ApiOperation({
    summary: 'Spending analysis (averages, largest, counts, by category)',
  })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Spending analysis' })
  async spending(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.spending(userId, await this.resolveQuery(userId, query));
  }

  @Get('financial-health')
  @ApiOperation({
    summary: 'Financial health indicators (score, saving rate, ratios)',
  })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Financial health' })
  async financialHealth(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.financialHealth(
      userId,
      await this.resolveQuery(userId, query),
    );
  }

  @Get('insights')
  @ApiOperation({ summary: 'Data-driven insights for the period' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Insights list' })
  async insights(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.insights(userId, await this.resolveQuery(userId, query));
  }
}
