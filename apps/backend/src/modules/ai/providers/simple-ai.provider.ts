import { Injectable } from '@nestjs/common';
import {
  AIProvider,
  AIProviderRequest,
  AISuggestion,
  TransactionType,
} from '../interfaces/ai-provider.interface';

interface CategoryRule {
  keywords: string[];
  labels: string[];
  confidence: number;
  reason: string;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    keywords: [
      'food',
      'restaurant',
      'dinner',
      'lunch',
      'meal',
      'coffee',
      'cafe',
      'pizza',
      'burger',
      'grocery',
      'groceries',
      'supermarket',
    ],
    labels: ['food', 'grocery', 'dining', 'restaurant'],
    confidence: 0.9,
    reason: 'The transaction text matches a food or grocery purchase.',
  },
  {
    keywords: [
      'transport',
      'taxi',
      'uber',
      'grab',
      'bus',
      'train',
      'fuel',
      'gas',
      'petrol',
      'parking',
      'ride',
    ],
    labels: ['transport', 'travel', 'taxi', 'uber', 'fuel', 'parking'],
    confidence: 0.9,
    reason: 'The transaction text matches a transportation expense.',
  },
  {
    keywords: [
      'electric',
      'water',
      'internet',
      'phone',
      'mobile',
      'gas bill',
      'utility',
      'utilities',
      'broadband',
      'subscription',
    ],
    labels: ['utilities', 'bill', 'internet', 'phone', 'subscription'],
    confidence: 0.88,
    reason: 'The transaction text matches a utilities or bill payment.',
  },
  {
    keywords: ['rent', 'mortgage', 'lease', 'housing'],
    labels: ['rent', 'housing', 'mortgage'],
    confidence: 0.95,
    reason: 'The transaction text matches a rent or housing expense.',
  },
  {
    keywords: ['salary', 'payroll', 'paycheck', 'income', 'deposit', 'refund'],
    labels: ['salary', 'income', 'deposit', 'refund'],
    confidence: 0.95,
    reason: 'The transaction text matches an income source.',
  },
];

@Injectable()
export class SimpleAiProvider implements AIProvider {
  async suggestTransactionCategory(
    request: AIProviderRequest,
  ): Promise<AISuggestion> {
    await Promise.resolve();
    const content = `${request.description ?? ''} ${request.merchant ?? ''}`
      .trim()
      .toLowerCase();

    const available = request.categories ?? [];
    if (available.length === 0) {
      return {
        categoryName: '',
        confidence: 0,
        reason: 'No categories are available for suggestion.',
      };
    }

    if (!content) {
      const fallback = this.findFallbackCategory(
        available,
        request.transactionType,
      );
      return {
        categoryName: fallback.name,
        confidence: 0.45,
        reason:
          'No description was provided, so a fallback category was selected.',
      };
    }

    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some((keyword) => content.includes(keyword))) {
        const match = this.findCategoryByLabels(
          available,
          rule.labels,
          request.transactionType,
        );
        if (match) {
          return {
            categoryName: match.name,
            confidence: rule.confidence,
            reason: rule.reason,
          };
        }
      }
    }

    const fallback = this.findFallbackCategory(
      available,
      request.transactionType,
    );
    return {
      categoryName: fallback.name,
      confidence: 0.55,
      reason:
        'A low-confidence category was selected based on available categories.',
    };
  }

  private findCategoryByLabels(
    categories: AIProviderRequest['categories'],
    labels: string[],
    transactionType: TransactionType,
  ) {
    const candidates = categories.filter((category) => {
      if (transactionType && category.type !== transactionType) {
        return false;
      }
      const normalizedName = category.name.toLowerCase();
      return labels.some((label) => normalizedName.includes(label));
    });
    return candidates.length > 0 ? candidates[0] : null;
  }

  private findFallbackCategory(
    categories: AIProviderRequest['categories'],
    transactionType: TransactionType,
  ) {
    const matchingType = categories.find(
      (category) => category.type === transactionType,
    );
    return matchingType ?? categories[0];
  }
}
