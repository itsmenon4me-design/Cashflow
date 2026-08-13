import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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

function buildRange(
  startDate?: string,
  endDate?: string,
): DateRange | undefined {
  if (!startDate && !endDate) return undefined;
  const start = new Date(startDate as string);
  const endDateRaw = endDate ? new Date(endDate) : new Date(start);
  const end = new Date(endDateRaw.getTime());
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class ReportsController {
  constructor(
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
    const range = buildRange(query.startDate, query.endDate);
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
    const range = buildRange(query.startDate, query.endDate);
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
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    return this.cashflowTrend.getTrend(userId, query.type, start, end);
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
    summary: 'Export reports (monthly|category|trend) in json or csv',
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
    const month = query.month;
    const year = query.year;
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const res = await this.exporter.export({
      type: query.type,
      format: query.format,
      month,
      year,
      startDate,
      endDate,
      userId,
    });

    // For simplicity, return an object with filename and content; controllers elsewhere stream files differently.
    return {
      filename: res.filename,
      contentType: res.contentType,
      content: res.content,
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
