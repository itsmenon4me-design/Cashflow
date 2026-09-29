import { Injectable } from '@nestjs/common';
import { DateHelper } from '../../../common/utils/date.util';
import { PrismaDashboardRepository } from '../repositories/prisma-dashboard.repository';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import { PrismaService } from '../../../database/prisma.service';
import { resolveUserTimezone } from '../../../common/utils/user-timezone.util';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PrismaDashboardRepository,
  ) {}

  async getSummaryForUser(userId: string): Promise<DashboardSummaryResponseDto> {
    const timeZone = await resolveUserTimezone(this.prisma, userId);
    const now = new Date();
    const monthStart = DateHelper.startOfMonthInTimezone(now, timeZone);
    const monthEnd = DateHelper.endOfMonthInTimezone(now, timeZone);

    return this.repo.getSummary(userId, monthStart, monthEnd, timeZone);
  }
}
