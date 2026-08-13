import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { CategoriesService } from '../../categories/services/categories.service';
import { AI_PROVIDER } from '../interfaces/ai-provider.interface';
import { ErrorCode } from '../../../common/errors/error-codes';

const categories = [
  {
    id: 'c1',
    name: 'Food',
    type: 'EXPENSE',
    is_system: false,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    user_id: 'u1',
    icon: null,
    color: null,
    description: null,
    parent_category_id: null,
    deleted_at: null,
  },
  {
    id: 'c2',
    name: 'Salary',
    type: 'INCOME',
    is_system: false,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    user_id: 'u1',
    icon: null,
    color: null,
    description: null,
    parent_category_id: null,
    deleted_at: null,
  },
];

describe('AiService', () => {
  let service: AiService;
  let providerMock: { suggestTransactionCategory: jest.Mock };
  let categoriesServiceMock: { listAll: jest.Mock };

  beforeEach(async () => {
    providerMock = {
      suggestTransactionCategory: jest.fn(),
    };
    categoriesServiceMock = {
      listAll: jest.fn().mockResolvedValue(categories),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AI_PROVIDER, useValue: providerMock },
        { provide: CategoriesService, useValue: categoriesServiceMock },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('returns a validated suggestion from the provider', async () => {
    providerMock.suggestTransactionCategory.mockResolvedValueOnce({
      categoryName: 'Food',
      confidence: 0.82,
      reason: 'Looks like dining out',
    });

    const result = await service.suggestTransactionCategory('u1', {
      description: 'Dinner at a restaurant',
      transaction_type: 'EXPENSE',
    });

    expect(result).toEqual({
      categoryId: 'c1',
      categoryName: 'Food',
      confidence: 0.82,
      reason: 'Looks like dining out',
    });
    expect(providerMock.suggestTransactionCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Dinner at a restaurant',
        transactionType: 'EXPENSE',
      }),
    );
  });

  it('rejects an invalid category returned by the provider', async () => {
    providerMock.suggestTransactionCategory.mockResolvedValueOnce({
      categoryName: 'Nonexistent',
      confidence: 0.9,
      reason: 'Invalid',
    });

    await expect(
      service.suggestTransactionCategory('u1', {
        description: 'Coffee',
        transaction_type: 'EXPENSE',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.DOMAIN_ERROR });
  });

  it('rejects a suggestion with invalid confidence', async () => {
    providerMock.suggestTransactionCategory.mockResolvedValueOnce({
      categoryName: 'Food',
      confidence: 2,
      reason: 'Too confident',
    });

    await expect(
      service.suggestTransactionCategory('u1', {
        description: 'Lunch',
        transaction_type: 'EXPENSE',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.DOMAIN_ERROR });
  });

  it('handles provider failure gracefully', async () => {
    providerMock.suggestTransactionCategory.mockRejectedValueOnce(
      new Error('Timeout'),
    );

    await expect(
      service.suggestTransactionCategory('u1', {
        description: 'Lunch',
        transaction_type: 'EXPENSE',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.DOMAIN_ERROR });
  });

  it('returns an error when the user has no categories', async () => {
    categoriesServiceMock.listAll.mockResolvedValueOnce([]);

    await expect(
      service.suggestTransactionCategory('u1', {
        description: 'Lunch',
        transaction_type: 'EXPENSE',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_INPUT });
  });
});
