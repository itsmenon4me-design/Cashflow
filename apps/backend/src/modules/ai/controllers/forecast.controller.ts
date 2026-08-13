import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ForecastService } from '../services/forecast.service';
import { ForecastQueryDto } from '../dto/forecast-query.dto';
import { ForecastResponseDto } from '../dto/forecast-response.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StandardErrorResponse } from '../../../common/swagger/dtos/standard-error.dto';

@ApiTags('AI')
@Controller('ai/forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get()
  @ApiOperation({
    summary: 'Forecast projected income, expense, and cashflow',
  })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: ForecastResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameter (e.g. out-of-range horizon)',
    type: StandardErrorResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid authentication',
    type: StandardErrorResponse,
  })
  async forecast(
    @CurrentUser('sub') userId: string,
    @Query() query: ForecastQueryDto,
  ): Promise<{ success: true; data: ForecastResponseDto }> {
    const result = await this.forecastService.forecast(userId, {
      horizon: query.horizon,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return { success: true, data: result };
  }
}
