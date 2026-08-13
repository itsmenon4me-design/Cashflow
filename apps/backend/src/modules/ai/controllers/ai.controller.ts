import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AiService,
  SuggestTransactionCategoryResult,
} from '../services/ai.service';
import { SuggestCategoryRequestDto } from '../dto/suggest-category.dto';
import { SuggestCategoryResponseDto } from '../dto/suggest-category-response.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('AI')
@Controller('ai/transactions')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggest-category')
  @ApiOperation({ summary: 'Suggest a transaction category using AI' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: SuggestCategoryResponseDto })
  async suggestCategory(
    @CurrentUser('sub') userId: string,
    @Body() body: SuggestCategoryRequestDto,
  ): Promise<{ success: true; data: SuggestTransactionCategoryResult }> {
    const result = await this.aiService.suggestTransactionCategory(
      userId,
      body,
    );
    return { success: true, data: result };
  }
}
