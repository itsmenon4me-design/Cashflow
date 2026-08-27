import { Injectable, Logger } from '@nestjs/common';
import { PrismaInvestmentsRepository } from '../repositories/prisma-investments.repository';
import { PrismaService } from '../../../database/prisma.service';
import { InvestmentEntity } from '../entities/investment.entity';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import {
  AuditAction,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';
import { CreateInvestmentDto } from '../dto/create-investment.dto';
import { UpdateInvestmentDto } from '../dto/update-investment.dto';
import { getCurrencySpec } from '../../../common/types/money';
import { FIXED_CURRENCY } from '../../../common/currencies';

interface PriceInput {
  quantity: number;
  average_buy_price: number;
  current_price: number;
  invested_amount_cents?: number;
}

function minorUnitMultiplier(currency: string): number {
  return 10 ** getCurrencySpec(currency).minorUnits;
}

function computeValues(input: PriceInput, multiplier: number) {
  const quantity = Number(input.quantity) || 0;
  const averageBuy = Number(input.average_buy_price) || 0;
  const currentPrice = Number(input.current_price) || 0;

  // Unit prices scaled to exact minor units
  const buyPriceMinor = Math.round(averageBuy * multiplier);
  const currentPriceMinor = Math.round(currentPrice * multiplier);

  const investedCents =
    input.invested_amount_cents !== undefined
      ? BigInt(Math.round(Number(input.invested_amount_cents)))
      : BigInt(Math.round(quantity * buyPriceMinor));

  const currentValueCents = BigInt(Math.round(quantity * currentPriceMinor));
  const profitLossCents = currentValueCents - investedCents;

  const percentage =
    investedCents === 0n
      ? 0
      : Number(
          (
            (profitLossCents * 10000n) /
            (investedCents < 0n ? -investedCents : investedCents)
          ).toString(),
        ) / 100;

  return {
    investedCents,
    currentValueCents,
    profitLossCents,
    percentage,
  };
}

@Injectable()
export class InvestmentsService {
  private readonly logger = new Logger(InvestmentsService.name);

  constructor(
    private readonly repo: PrismaInvestmentsRepository,
    private readonly audit: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveAccountCurrency(
    userId: string,
    accountId?: string | null,
  ): Promise<string> {
    if (!accountId) {
      return FIXED_CURRENCY;
    }
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account || account.deleted_at || account.user_id !== userId) {
      throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Invalid account');
    }
    return account.currency ?? 'IDR';
  }

  async create(
    userId: string,
    input: CreateInvestmentDto,
  ): Promise<InvestmentEntity> {
    const resolvedCurrency = await this.resolveAccountCurrency(userId, input.account_id);

    const currencyToUse = resolvedCurrency;

    const values = computeValues(input, minorUnitMultiplier(currencyToUse));
    const created = await this.repo.create({
      user_id: userId,
      account_id: input.account_id ?? null,
      currency: currencyToUse,
      investment_type: input.investment_type,
      platform: input.platform,
      name: input.name,
      symbol: input.symbol ?? null,
      quantity: String(input.quantity),
      average_buy_price: String(input.average_buy_price),
      current_price: String(input.current_price),
      invested_amount_cents: BigInt(values.investedCents),
      current_value_cents: BigInt(values.currentValueCents),
      profit_loss_cents: BigInt(values.profitLossCents),
      profit_loss_percentage: values.percentage.toFixed(2),
      purchase_date: new Date(input.purchase_date),
      notes: input.notes ?? null,
      status: input.status ?? 'ACTIVE',
    } as any);

    void this.audit.record({
      userId,
      action: AuditAction.INVESTMENT_CREATED,
      module: AuditModule.INVESTMENT,
      entityType: 'Investment',
      entityId: created.id,
    });
    this.logger.log(`Investment Created user=${userId} id=${created.id}`);
    return created;
  }

  async getById(userId: string, id: string): Promise<InvestmentEntity> {
    const item = await this.repo.findById(id);
    if (!item) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Investment not found');
    }
    if (item.user_id !== userId) {
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    }
    return item;
  }

  async listAll(userId: string): Promise<InvestmentEntity[]> {
    return this.repo.findAllByUser(userId);
  }


  async update(
    userId: string,
    id: string,
    updates: UpdateInvestmentDto,
  ): Promise<InvestmentEntity> {
    const current = await this.getById(userId, id);

    const nextAccountId =
      updates.account_id !== undefined
        ? updates.account_id
        : current.account_id;
    const resolvedCurrency = updates.currency
      ?? await this.resolveAccountCurrency(userId, nextAccountId);

    const quantity =
      updates.quantity !== undefined
        ? Number(updates.quantity)
        : Number(current.quantity);
    const averageBuyPrice =
      updates.average_buy_price !== undefined
        ? Number(updates.average_buy_price)
        : Number(current.average_buy_price);
    const currentPrice =
      updates.current_price !== undefined
        ? Number(updates.current_price)
        : Number(current.current_price);
    const investedInput =
      updates.invested_amount_cents !== undefined
        ? Number(updates.invested_amount_cents)
        : Number(current.invested_amount_cents);

    const values = computeValues(
      {
        quantity,
        average_buy_price: averageBuyPrice,
        current_price: currentPrice,
        invested_amount_cents: investedInput,
      },
      minorUnitMultiplier(resolvedCurrency),
    );

    const data: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      const value = (updates as unknown as Record<string, unknown>)[key];
      if (value !== undefined) data[key] = value;
    }
    if (updates.currency !== undefined) {
      data.currency = updates.currency;
    }
    data.quantity = String(quantity);
    data.average_buy_price = String(averageBuyPrice);
    data.current_price = String(currentPrice);
    data.invested_amount_cents = BigInt(values.investedCents);
    data.current_value_cents = BigInt(values.currentValueCents);
    data.profit_loss_cents = BigInt(values.profitLossCents);
    data.profit_loss_percentage = values.percentage.toFixed(2);
    if (updates.purchase_date !== undefined) {
      data.purchase_date = new Date(updates.purchase_date);
    }

    const updated = await this.repo.update(id, data as any);

    void this.audit.record({
      userId,
      action: AuditAction.INVESTMENT_UPDATED,
      module: AuditModule.INVESTMENT,
      entityType: 'Investment',
      entityId: updated.id,
    });
    this.logger.log(`Investment Updated user=${userId} id=${updated.id}`);
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.repo.softDelete(id);
    void this.audit.record({
      userId,
      action: AuditAction.INVESTMENT_DELETED,
      module: AuditModule.INVESTMENT,
      entityType: 'Investment',
      entityId: id,
    });
    this.logger.log(`Investment Deleted user=${userId} id=${id}`);
  }

  async overview(userId: string) {
    const items = await this.repo.findAllByUser(userId);
    const active = items.filter((i) => i.status === 'ACTIVE');

    // Group active investments by currency (via linked account or fallback IDR)
    const currencyMap = new Map<
      string,
      {
        invested: bigint;
        value: bigint;
        profit: bigint;
        loss: bigint;
        allocation: Record<string, bigint>;
      }
    >();

    for (const item of active) {
      const currency =
        item.currency ?? FIXED_CURRENCY;
      const entry = currencyMap.get(currency) ?? {
        invested: 0n,
        value: 0n,
        profit: 0n,
        loss: 0n,
        allocation: {},
      };

      entry.invested += item.invested_amount_cents;
      entry.value += item.current_value_cents;
      const pl = item.profit_loss_cents;
      if (pl > 0n) entry.profit += pl;
      else entry.loss += pl;

      entry.allocation[item.investment_type] =
        (entry.allocation[item.investment_type] ?? 0n) +
        item.current_value_cents;

      currencyMap.set(currency, entry);
    }

    if (currencyMap.size === 0) {
      currencyMap.set(FIXED_CURRENCY, {
        invested: 0n,
        value: 0n,
        profit: 0n,
        loss: 0n,
        allocation: {},
      });
    }

    const primaryCurrency = Array.from(currencyMap.keys())[0] ?? 'IDR';
    const primary = currencyMap.get(primaryCurrency)!;
    const investedNum = Number(primary.invested);
    const primaryRoi =
      investedNum === 0
        ? 0
        : ((Number(primary.value) - investedNum) / investedNum) * 100;

    const byCurrency = Array.from(currencyMap.entries()).map(([curr, data]) => {
      const invNum = Number(data.invested);
      const roi =
        invNum === 0 ? 0 : ((Number(data.value) - invNum) / invNum) * 100;
      return {
        currency: curr,
        totalInvested: data.invested.toString(),
        totalValue: data.value.toString(),
        totalProfit: data.profit.toString(),
        totalLoss: (data.loss * -1n).toString(),
        roi,
        allocation: Object.entries(data.allocation)
          .map(([type, total]) => ({ type, total: total.toString() }))
          .sort((a, b) => Number(b.total) - Number(a.total)),
      };
    });

    return {
      total: items.length,
      active: active.length,
      currency: primaryCurrency,
      totalInvested: primary.invested.toString(),
      totalValue: primary.value.toString(),
      totalProfit: primary.profit.toString(),
      totalLoss: (primary.loss * -1n).toString(),
      roi: primaryRoi,
      allocation: Object.entries(primary.allocation)
        .map(([type, total]) => ({ type, total: total.toString() }))
        .sort((a, b) => Number(b.total) - Number(a.total)),
      by_currency: byCurrency,
    };
  }
}
