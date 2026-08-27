import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SpendingPredictionService } from '../services/spending-prediction.service';
import { SpendingPredictionQueryDto } from '../dto/spending-prediction-query.dto';
import { SpendingPredictionResponseDto } from '../dto/spending-prediction-response.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StandardErrorResponse } from '../../../common/swagger/dtos/standard-error.dto';

@ApiTags('AI')
@Controller('ai/spending-prediction')
export class SpendingPredictionController {
  constructor(
    private readonly spendingPredictionService: SpendingPredictionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Predict upcoming spending' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: SpendingPredictionResponseDto })
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
  async predict(
    @CurrentUser('sub') userId: string,
    @Query() query: SpendingPredictionQueryDto,
  ): Promise<{ success: true; data: SpendingPredictionResponseDto }> {
    const result = await this.spendingPredictionService.predict(userId, {
      horizon: query.horizon,
    });
    return { success: true, data: result };
  }
}
