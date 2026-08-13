import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService } from '../services/transactions.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { toTransactionResponse } from '../mappers/transaction.mapper';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { PaginatedTransactionResponseDto } from '../dto/paginated-transaction-response.dto';
import { SearchTransactionDto } from '../dto/search-transaction.dto';
import { ApiQuery } from '@nestjs/swagger';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly tx: TransactionsService) {}

  private getHeaderValue(
    req: { headers?: Record<string, string | string[] | undefined> } | undefined,
    headerName: string,
  ): string | undefined {
    const value = req?.headers?.[headerName.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return value ?? undefined;
  }

  @Get()
  @ApiOperation({
    summary:
      'List transactions for current user (supports filtering, sorting, pagination)',
  })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: PaginatedTransactionResponseDto })
  async list(
    @CurrentUser('sub') userId: string,
    @Query() filter: TransactionFilterDto,
  ) {
    const pagination = { page: filter.page ?? 1, limit: filter.limit ?? 20 };
    const result = await this.tx.listAll(userId, filter, pagination);
    return {
      success: true,
      data: result.data.map((i) => toTransactionResponse(i)),
      pagination: result.pagination,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search transactions by keyword' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: PaginatedTransactionResponseDto })
  @ApiQuery({ name: 'q', required: true, description: 'Search keyword' })
  async search(
    @CurrentUser('sub') userId: string,
    @Query() query: SearchTransactionDto,
  ) {
    const pagination = { page: query.page ?? 1, limit: query.limit ?? 20 };
    const result = await this.tx.search(userId, query.q, pagination);
    return {
      success: true,
      data: result.data.map((i) => toTransactionResponse(i)),
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by id' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async get(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const t = await this.tx.getById(userId, id);
    return { success: true, data: toTransactionResponse(t) };
  }

  @Post()
  @ApiOperation({ summary: 'Create transaction' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('sub') userId: string,
    @Body() body: CreateTransactionDto,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; correlationId?: string; requestId?: string },
  ) {
    const trace = {
      correlationId: req?.correlationId ?? this.getHeaderValue(req, 'x-correlation-id'),
      requestId: req?.requestId ?? this.getHeaderValue(req, 'x-request-id'),
    };
    const created = await this.tx.create(
      userId,
      {
        ...body,
        amount_cents: BigInt(body.amount_cents),
        transaction_date: new Date(body.transaction_date),
      },
      trace,
    );
    return { success: true, data: toTransactionResponse(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update transaction' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: UpdateTransactionDto,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; correlationId?: string; requestId?: string },
  ) {
    const trace = {
      correlationId: req?.correlationId ?? this.getHeaderValue(req, 'x-correlation-id'),
      requestId: req?.requestId ?? this.getHeaderValue(req, 'x-request-id'),
    };
    const prepared:
      | import('../entities/transaction.entity').TransactionEntity
      | Partial<import('../entities/transaction.entity').TransactionEntity> = {
      ...body,
    } as Partial<import('../entities/transaction.entity').TransactionEntity>;
    if (body.amount_cents !== undefined)
      prepared.amount_cents = BigInt(body.amount_cents);
    if (body.transaction_date !== undefined)
      prepared.transaction_date = new Date(body.transaction_date);
    const updated = await this.tx.update(userId, id, prepared, trace);
    return { success: true, data: toTransactionResponse(updated) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete transaction' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.tx.softDelete(userId, id);
    return { success: true };
  }
}
