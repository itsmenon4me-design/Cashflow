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
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedTransactionResponseDto } from '../dto/paginated-transaction-response.dto';
import { SearchTransactionDto } from '../dto/search-transaction.dto';
import { ApiQuery } from '@nestjs/swagger';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly tx: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List transactions for current user (supports filtering, sorting, pagination)',
  })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: PaginatedTransactionResponseDto })
  async list(
    @Req() req: Request & { user?: { sub?: string } },
    @Query() filter: TransactionFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    const userId = req.user?.sub as string;
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
    @Req() req: Request & { user?: { sub?: string } },
    @Query() query: SearchTransactionDto,
    @Query() pagination: PaginationDto,
  ) {
    const userId = req.user?.sub as string;
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
    @Req() req: Request & { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub as string;
    const t = await this.tx.getById(userId, id);
    return { success: true, data: toTransactionResponse(t) };
  }

  @Post()
  @ApiOperation({ summary: 'Create transaction' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: Request & { user?: { sub?: string } },
    @Body() body: CreateTransactionDto,
  ) {
    const userId = req.user?.sub as string;
    const created = await this.tx.create(userId, {
      ...body,
      amount_cents: BigInt(body.amount_cents),
      transaction_date: new Date(body.transaction_date),
    });
    return { success: true, data: toTransactionResponse(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update transaction' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: Request & { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() body: UpdateTransactionDto,
  ) {
    const userId = req.user?.sub as string;
    const prepared:
      | import('../entities/transaction.entity').TransactionEntity
      | Partial<import('../entities/transaction.entity').TransactionEntity> = {
      ...body,
    } as Partial<import('../entities/transaction.entity').TransactionEntity>;
    if (body.amount_cents !== undefined)
      prepared.amount_cents = BigInt(body.amount_cents);
    if (body.transaction_date !== undefined)
      prepared.transaction_date = new Date(body.transaction_date);
    const updated = await this.tx.update(userId, id, prepared);
    return { success: true, data: toTransactionResponse(updated) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete transaction' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async delete(
    @Req() req: Request & { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub as string;
    await this.tx.softDelete(userId, id);
    return { success: true };
  }
}
