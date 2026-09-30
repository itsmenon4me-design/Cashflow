import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DateHelper } from '../../../common/utils/date.util';
import { resolveUserTimezone } from '../../../common/utils/user-timezone.util';
import { PrismaService } from '../../../database/prisma.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MonthlyReportService } from '../services/monthly-report.service';
import { CategoryBreakdownService } from '../services/category-breakdown.service';
import { CashflowTrendService } from '../services/cashflow-trend.service';
import { BudgetAnalyticsService } from '../services/budget-analytics.service';
import { ReportExportService } from '../services/report-export.service';
import { FinancialInsightsService } from '../services/financial-insights.service';
import { MonthlyReportResponseDto } from '../dto/monthly-report-response.dto';
import { CategoryBreakdownResponseDto } from '../dto/category-breakdown-response.dto';
import { CashflowTrendResponseDto } from '../dto/trend-response.dto';
import { BudgetAnalysisResponseDto } from '../dto/budget-analysis-response.dto';
import { FinancialInsightsResponseDto } from '../dto/financial-insights-response.dto';
import { MonthlyReportQueryDto } from '../dto/monthly-report-query.dto';
import { CategoryBreakdownQueryDto } from '../dto/category-breakdown-query.dto';
import { TrendQueryDto } from '../dto/trend-query.dto';
import { BudgetQueryDto } from '../dto/budget-query.dto';
import { ExportQueryDto } from '../dto/export-query.dto';
import { FinancialInsightsQueryDto } from '../dto/financial-insights-query.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

interface DateRange {
  start: Date;
  end: Date;
}

async function buildRange(
  userId: string,
  prisma: PrismaService,
  startDate?: string,
  endDate?: string,
  resolvedTimeZone?: string,
): Promise<DateRange | undefined> {
  if (!startDate && !endDate) return undefined;
  if (!startDate || !endDate) {
    const date = startDate || endDate;
    if (!date) return undefined;
    const timeZone =
      resolvedTimeZone ?? (await resolveUserTimezone(prisma, userId));
    return {
      start: DateHelper.startOfDayInTimezone(date, timeZone),
      end: DateHelper.endOfDayInTimezone(date, timeZone),
    };
  }
  const timeZone =
    resolvedTimeZone ?? (await resolveUserTimezone(prisma, userId));
  const parseBoundary = (value: string, boundary: 'start' | 'end') => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return boundary === 'start'
        ? DateHelper.startOfDayInTimezone(value, timeZone)
        : DateHelper.endOfDayInTimezone(value, timeZone);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${boundary} date`);
    }
    return date;
  };
  const start = parseBoundary(startDate, 'start');
  const end = parseBoundary(endDate, 'end');
  return { start, end };
}

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monthly: MonthlyReportService,
    private readonly categoryBreakdown: CategoryBreakdownService,
    private readonly cashflowTrend: CashflowTrendService,
    private readonly budgetAnalytics: BudgetAnalyticsService,
    private readonly exporter: ReportExportService,
    private readonly insights: FinancialInsightsService,
  ) {}
  @Get('monthly')
  @ApiOperation({
    summary: 'Get monthly financial report for authenticated user',
  })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Monthly report',
    type: MonthlyReportResponseDto,
  })
  async getMonthly(
    @CurrentUser('sub') userId: string,
    @Query() query: MonthlyReportQueryDto,
  ) {
    const range = await buildRange(
      userId,
      this.prisma,
      query.startDate,
      query.endDate,
    );
    return this.monthly.getMonthlyReport(
      userId,
      query.month,
      query.year,
      range,
    );
  }

  @Get('category-breakdown')
  @ApiOperation({
    summary: 'Get category breakdown by type (income|expense) for a month',
  })
  @ApiQuery({ name: 'type', required: true, type: String })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Category breakdown',
    type: CategoryBreakdownResponseDto,
  })
  async getCategoryBreakdown(
    @CurrentUser('sub') userId: string,
    @Query() query: CategoryBreakdownQueryDto,
  ) {
    const range = await buildRange(
      userId,
      this.prisma,
      query.startDate,
      query.endDate,
    );
    return this.categoryBreakdown.getBreakdown(
      userId,
      query.type,
      query.month,
      query.year,
      range,
    );
  }

  @Get('cashflow-trend')
  @ApiOperation({
    summary: 'Get cashflow trend (daily|weekly|monthly) for a date range',
  })
  @ApiQuery({ name: 'type', required: true, type: String })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Cashflow trend',
    type: CashflowTrendResponseDto,
  })
  async getCashflowTrend(
    @CurrentUser('sub') userId: string,
    @Query() query: TrendQueryDto,
  ) {
    const range = await buildRange(
      userId,
      this.prisma,
      query.startDate,
      query.endDate,
    );
    if (!range) {
      throw new BadRequestException(
        'Both startDate and endDate are required for a date range',
      );
    }
    return this.cashflowTrend.getTrend(
      userId,
      query.type,
      range.start,
      range.end,
    );
  }

  @Get('budget-analysis')
  @ApiOperation({ summary: 'Get budget analysis for a month' })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Budget analysis',
    type: BudgetAnalysisResponseDto,
  })
  async getBudgetAnalysis(
    @CurrentUser('sub') userId: string,
    @Query() query: BudgetQueryDto,
  ) {
    return this.budgetAnalytics.analyzeMonth(userId, query.month, query.year);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export report data as CSV or a styled XLSX workbook',
  })
  @ApiQuery({ name: 'type', required: true, type: String })
  @ApiQuery({ name: 'format', required: true, type: String })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async exportReport(
    @CurrentUser('sub') userId: string,
    @Query() query: ExportQueryDto,
  ) {
    if (Boolean(query.startDate) !== Boolean(query.endDate)) {
      throw new BadRequestException(
        'Both startDate and endDate are required for a date range',
      );
    }
    const month = query.month;
    const year = query.year;
    const timeZone = await resolveUserTimezone(this.prisma, userId);
    const range = query.startDate
      ? await buildRange(
          userId,
          this.prisma,
          query.startDate,
          query.endDate,
          timeZone,
        )
      : undefined;

    const res = await this.exporter.export({
      type: query.type,
      format: query.format,
      month,
      year,
      startDate: range?.start,
      endDate: range?.end,
      userId,
      timeZone,
    });

    return {
      filename: res.filename,
      contentType: res.contentType,
      content: Buffer.isBuffer(res.content)
        ? res.content.toString('base64')
        : res.content,
      contentEncoding: Buffer.isBuffer(res.content) ? 'base64' : 'utf-8',
    };
  }

  @Get('financial-insights')
  @ApiOperation({ summary: 'Get financial insights for month' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Financial insights',
    type: FinancialInsightsResponseDto,
  })
  async getFinancialInsights(
    @CurrentUser('sub') userId: string,
    @Query() query: FinancialInsightsQueryDto,
  ) {
    return this.insights.getInsights(userId, query.month, query.year);
  }
}
