import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { DashboardService } from '../services/dashboard.service';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get dashboard summary for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary returned',
    type: DashboardSummaryResponseDto,
  })
  async getSummary(
    @CurrentUser('sub') userId: string,
  ): Promise<DashboardSummaryResponseDto> {
    return this.service.getSummaryForUser(userId);
  }
}
