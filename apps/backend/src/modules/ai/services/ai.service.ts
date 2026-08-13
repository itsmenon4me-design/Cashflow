import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_PROVIDER } from '../interfaces/ai-provider.interface';
import type { AIProvider } from '../interfaces/ai-provider.interface';
import { CategoriesService } from '../../categories/services/categories.service';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';

export interface SuggestTransactionCategoryRequest {
  description?: string;
  merchant?: string;
  amount?: number;
  transaction_type: 'INCOME' | 'EXPENSE';
}

export interface SuggestTransactionCategoryResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reason?: string | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER)
    private readonly provider: AIProvider,
    private readonly categoriesService: CategoriesService,
  ) {}

  async suggestTransactionCategory(
    userId: string,
    request: SuggestTransactionCategoryRequest,
  ): Promise<SuggestTransactionCategoryResult> {
    const categories = await this.categoriesService.listAll(userId);
    if (!categories.length) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'User has no available categories for suggestions',
      );
    }

    let suggestion;
    try {
      suggestion = await this.provider.suggestTransactionCategory({
        description: request.description,
        merchant: request.merchant,
        amount: request.amount,
        transactionType: request.transaction_type,
        categories: categories.map((category) => ({
          name: category.name,
          type: category.type,
        })),
      });
    } catch (error) {
      this.logger.error(
        `AI provider failed for user=${userId}: ${(error as Error).message}`,
      );
      throw ErrorService.create(
        ErrorCode.DOMAIN_ERROR,
        'AI provider is unavailable at the moment',
      );
    }

    if (!suggestion || typeof suggestion.categoryName !== 'string') {
      throw ErrorService.create(
        ErrorCode.DOMAIN_ERROR,
        'AI provider returned an invalid category suggestion',
      );
    }

    if (
      suggestion.confidence === undefined ||
      suggestion.confidence < 0 ||
      suggestion.confidence > 1
    ) {
      throw ErrorService.create(
        ErrorCode.DOMAIN_ERROR,
        'AI provider returned an invalid confidence score',
      );
    }

    const matchedCategory =
      categories.find(
        (category) =>
          category.name === suggestion.categoryName &&
          category.type === request.transaction_type,
      ) ??
      categories.find((category) => category.name === suggestion.categoryName);

    if (!matchedCategory) {
      throw ErrorService.create(
        ErrorCode.DOMAIN_ERROR,
        'AI provider returned a category that does not belong to the user',
      );
    }

    return {
      categoryId: matchedCategory.id,
      categoryName: matchedCategory.name,
      confidence: Math.max(0, Math.min(1, suggestion.confidence)),
      reason: suggestion.reason ?? null,
    };
  }
}
