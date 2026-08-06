import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
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
import type { Request } from 'express';

type RequestWithUser = Request & { user?: { id?: string } };

@ApiTags('Reports')
@Controller('reports')
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
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Monthly report',
    type: MonthlyReportResponseDto,
  })
  async getMonthly(
    @Req() req: RequestWithUser,
    @Query()
    query: import('../dto/monthly-report-query.dto').MonthlyReportQueryDto,
  ) {
    const userId = req.user?.id as string;
    return this.monthly.getMonthlyReport(userId, query.month, query.year);
  }

  @Get('category-breakdown')
  @ApiOperation({
    summary: 'Get category breakdown by type (income|expense) for a month',
  })
  @ApiQuery({ name: 'type', required: true, type: String })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Category breakdown',
    type: CategoryBreakdownResponseDto,
  })
  async getCategoryBreakdown(
    @Req() req: RequestWithUser,
    @Query()
    query: import('../dto/category-breakdown-query.dto').CategoryBreakdownQueryDto,
  ) {
    const userId = req.user?.id as string;
    return this.categoryBreakdown.getBreakdown(
      userId,
      query.type,
      query.month,
      query.year,
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
    @Req() req: RequestWithUser,
    @Query() query: import('../dto/trend-query.dto').TrendQueryDto,
  ) {
    const userId = req.user?.id as string;
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
    @Req() req: RequestWithUser,
    @Query() query: import('../dto/budget-query.dto').BudgetQueryDto,
  ) {
    const userId = req.user?.id as string;
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
    @Req() req: RequestWithUser,
    @Query() query: import('../dto/export-query.dto').ExportQueryDto,
  ) {
    const userId = req.user?.id as string;
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
    @Req() req: RequestWithUser,
    @Query()
    query: import('../dto/financial-insights-query.dto').FinancialInsightsQueryDto,
  ) {
    const userId = req.user?.id as string;
    return this.insights.getInsights(userId, query.month, query.year);
  }
}
