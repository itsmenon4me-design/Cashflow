import { Injectable } from '@nestjs/common';
import { PrismaDashboardRepository } from '../repositories/prisma-dashboard.repository';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly repo: PrismaDashboardRepository) {}

  async getSummaryForUser(userId: string): Promise<DashboardSummaryResponseDto> {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );

    return this.repo.getSummary(userId, monthStart, monthEnd);
  }
}
