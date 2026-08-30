import { Injectable } from '@nestjs/common';
import { DateHelper } from '../../../common/utils/date.util';
import { PrismaDashboardRepository } from '../repositories/prisma-dashboard.repository';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly repo: PrismaDashboardRepository) {}

  async getSummaryForUser(userId: string): Promise<DashboardSummaryResponseDto> {
    const monthStart = DateHelper.startOfMonth();
    const monthEnd = DateHelper.endOfMonth();

    return this.repo.getSummary(userId, monthStart, monthEnd);
  }
}
