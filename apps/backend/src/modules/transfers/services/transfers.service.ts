import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '@prisma/client';
import type { PrismaClient, Transaction } from '@prisma/client';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import {
  AuditAction,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { TransactionValidationService } from '../../transactions/services/validation/transaction-validation.service';
import * as crypto from 'crypto';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly validator: TransactionValidationService,
  ) {}

  async create(
    userId: string,
    input: {
      source_account_id: string;
      destination_account_id: string;
      amount_cents: bigint;
      reference?: string | null;
      transaction_date?: Date;
      note?: string | null;
    },
  ) {
    const {
      source_account_id,
      destination_account_id,
      amount_cents,
      reference,
      transaction_date,
      note,
    } = input;

    // Basic validation
    if (source_account_id === destination_account_id) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Source and destination accounts must differ',
      );
    }
    if (amount_cents <= BigInt(0))
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Amount must be greater than zero',
      );

    // Fetch accounts
    const src = await this.prisma.account.findUnique({
      where: { id: source_account_id },
    });
    const dst = await this.prisma.account.findUnique({
      where: { id: destination_account_id },
    });

    if (!src || src.deleted_at)
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Invalid or inaccessible source account',
      );
    if (!dst || dst.deleted_at)
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Invalid or inaccessible destination account',
      );
    if (src.user_id !== userId || dst.user_id !== userId)
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Unauthorized account');
    if (!src.is_active)
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Source account is not active',
      );
    if (!dst.is_active)
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Destination account is not active',
      );

    // Create transfer group id
    const transferGroupId = crypto.randomUUID();
    const txDate = transaction_date ?? new Date();

    try {
      const results: { out: Transaction; inp: Transaction } =
        await this.prisma.$transaction(async (tx: PrismaClient) => {
          // Create outgoing transaction (EXPENSE)
          const out = await tx.transaction.create({
            data: {
              user_id: userId,
              account_id: source_account_id,
              // Using placeholder category - requires seed or existing 'Transfer Out' category for the user
              category_id:
                (
                  await tx.category.findFirst({
                    where: { user_id: userId, name: 'Transfer Out' },
                  })
                )?.id ?? '',
              transaction_type: TransactionType.EXPENSE,
              amount_cents: amount_cents,
              transaction_date: txDate,
              note: note ?? null,
              transfer_group_id: transferGroupId,
              transfer_reference: reference ?? null,
            },
          });

          // Create incoming transaction (INCOME)
          const inp = await tx.transaction.create({
            data: {
              user_id: userId,
              account_id: destination_account_id,
              category_id:
                (
                  await tx.category.findFirst({
                    where: { user_id: userId, name: 'Transfer In' },
                  })
                )?.id ?? '',
              transaction_type: TransactionType.INCOME,
              amount_cents: amount_cents,
              transaction_date: txDate,
              note: note ?? null,
              transfer_group_id: transferGroupId,
              transfer_reference: reference ?? null,
            },
          });

          // Update account balances atomically
          const newSrcBal =
            BigInt(src.current_balance_cents ?? '0') - amount_cents;
          await tx.account.update({
            where: { id: source_account_id },
            data: { current_balance_cents: newSrcBal },
          });

          const newDstBal =
            BigInt(dst.current_balance_cents ?? '0') + amount_cents;
          await tx.account.update({
            where: { id: destination_account_id },
            data: { current_balance_cents: newDstBal },
          });

          return { out, inp };
        });

      void this.audit.record({
        userId,
        action: AuditAction.TRANSFER_CREATED,
        module: AuditModule.TRANSACTION,
        entityType: 'Transfer',
        entityId: transferGroupId,
        metadata: {
          source: source_account_id,
          destination: destination_account_id,
          amount: amount_cents.toString(),
        },
      });

      this.logger.log(
        `Transfer Created user=${userId} group=${transferGroupId} amount=${amount_cents.toString()}`,
      );
      return {
        id: transferGroupId,
        source_transaction_id: results.out.id,
        destination_transaction_id: results.inp.id,
        amount_cents: amount_cents.toString(),
        reference: reference ?? null,
        created_at: results.out.created_at,
      };
    } catch (err) {
      this.logger.warn(
        `Transfer Failed user=${userId} from=${source_account_id} to=${destination_account_id} err=${String(err)}`,
      );
      void this.audit.record({
        userId,
        action: AuditAction.TRANSFER_FAILED ?? 'TRANSFER_FAILED',
        module: AuditModule.TRANSACTION,
        entityType: 'Transfer',
        entityId: transferGroupId,
        metadata: { error: String(err) },
      });
      throw err;
    }
  }

  async list(userId: string) {
    const recs: Transaction[] = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        transfer_group_id: { not: null },
        deleted_at: null,
      },
      orderBy: { created_at: 'desc' },
    });
    const groups: Record<string, Transaction[]> = {};
    for (const r of recs) {
      const g = String(r.transfer_group_id);
      groups[g] = groups[g] ?? [];
      groups[g].push(r);
    }
    const out = Object.entries(groups).map(([gid, arr]) => {
      const outTx = arr.find(
        (x) => x.transaction_type === TransactionType.EXPENSE,
      );
      const inTx = arr.find(
        (x) => x.transaction_type === TransactionType.INCOME,
      );
      return {
        id: gid,
        source_transaction_id: outTx?.id ?? null,
        destination_transaction_id: inTx?.id ?? null,
        amount_cents: outTx?.amount_cents ?? inTx?.amount_cents ?? '0',
        reference:
          outTx?.transfer_reference ?? inTx?.transfer_reference ?? null,
        created_at: outTx?.created_at ?? inTx?.created_at,
      };
    });
    return out;
  }

  async findById(userId: string, id: string) {
    const recs: Transaction[] = await this.prisma.transaction.findMany({
      where: { user_id: userId, transfer_group_id: id, deleted_at: null },
    });
    if (!recs || recs.length === 0)
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Transfer not found');
    const outTx = recs.find(
      (x) => x.transaction_type === TransactionType.EXPENSE,
    );
    const inTx = recs.find(
      (x) => x.transaction_type === TransactionType.INCOME,
    );
    return {
      id,
      source_transaction_id: outTx?.id ?? null,
      destination_transaction_id: inTx?.id ?? null,
      amount_cents: outTx?.amount_cents ?? inTx?.amount_cents ?? '0',
      reference: outTx?.transfer_reference ?? inTx?.transfer_reference ?? null,
      created_at: outTx?.created_at ?? inTx?.created_at,
    };
  }
}
