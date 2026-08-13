import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalculate account balance from opening balance and transactions.
   */
  async recalculateAccount(accountId: string): Promise<bigint> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const [income, expense] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          account_id: accountId,
          deleted_at: null,
          transaction_type: TransactionType.INCOME,
        },
        _sum: {
          amount_cents: true,
        },
      }),

      this.prisma.transaction.aggregate({
        where: {
          account_id: accountId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
        },
        _sum: {
          amount_cents: true,
        },
      }),
    ]);

    const opening =
      typeof account.opening_balance_cents === 'bigint'
        ? account.opening_balance_cents
        : BigInt(account.opening_balance_cents ?? 0);

    const incomeAmount =
      typeof income._sum.amount_cents === 'bigint'
        ? income._sum.amount_cents
        : BigInt(income._sum.amount_cents ?? 0);

    const expenseAmount =
      typeof expense._sum.amount_cents === 'bigint'
        ? expense._sum.amount_cents
        : BigInt(expense._sum.amount_cents ?? 0);

    const newBalance = opening + incomeAmount - expenseAmount;

    await this.prisma.account.update({
      where: {
        id: accountId,
      },
      data: {
        current_balance_cents: newBalance,
      },
    });

    this.logger.log(
      `Recalculated account ${accountId} -> ${newBalance.toString()}`,
    );

    return newBalance;
  }
}
