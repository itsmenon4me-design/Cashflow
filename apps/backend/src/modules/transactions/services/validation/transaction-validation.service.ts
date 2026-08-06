import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { ErrorService } from '../../../../common/errors/error.service';
import { ErrorCode } from '../../../../common/errors/error-codes';
import { TransactionEntity } from '../../entities/transaction.entity';

@Injectable()
export class TransactionValidationService {
  private readonly logger = new Logger(TransactionValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async findAccount(userId: string, accountId: string) {
    const acc = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!acc) return null;
    if (acc.deleted_at) return null;
    if (acc.user_id !== userId) return null;

    return acc;
  }

  private async findCategory(userId: string, categoryId: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!cat) return null;
    if (cat.deleted_at) return null;

    // Allow system categories
    if (!cat.is_system && cat.user_id !== userId) return null;

    return cat;
  }

  async validateForCreate(
    userId: string,
    tx: Partial<TransactionEntity>,
  ): Promise<boolean> {
    // Account
    if (!tx.account_id) {
      throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Account is required');
    }

    const acc = await this.findAccount(userId, tx.account_id);

    if (!acc) {
      this.logger.warn(
        `Validation Failed: invalid account user=${userId} account=${tx.account_id}`,
      );

      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Invalid or inaccessible account',
      );
    }

    if (!acc.is_active) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Account is not active',
      );
    }

    // Category
    if (!tx.category_id) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Category is required',
      );
    }

    const cat = await this.findCategory(userId, tx.category_id);

    if (!cat) {
      this.logger.warn(
        `Validation Failed: invalid category user=${userId} category=${tx.category_id}`,
      );

      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Invalid or inaccessible category',
      );
    }

    if (!cat.is_active) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Category is not active',
      );
    }

    // Amount
    if (
      tx.amount_cents === undefined ||
      tx.amount_cents === null ||
      tx.amount_cents <= BigInt(0)
    ) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Amount must be greater than zero',
      );
    }

    // Transaction type
    if (tx.transaction_type && tx.transaction_type !== cat.type) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Transaction type does not match category type',
      );
    }

    // Transaction date
    if (!tx.transaction_date) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Transaction date is required',
      );
    }

    const maxDays = Number.parseInt(
      process.env.MAX_FUTURE_TRANSACTION_DAYS ?? '30',
      10,
    );

    const txTime = new Date(tx.transaction_date).getTime();

    if (Number.isNaN(txTime)) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Invalid transaction date',
      );
    }

    if (txTime - Date.now() > maxDays * 24 * 60 * 60 * 1000) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Transaction date is too far in the future',
      );
    }

    return true;
  }

  async validateForUpdate(
    userId: string,
    tx: Partial<TransactionEntity>,
  ): Promise<boolean> {
    return this.validateForCreate(userId, tx);
  }
}
