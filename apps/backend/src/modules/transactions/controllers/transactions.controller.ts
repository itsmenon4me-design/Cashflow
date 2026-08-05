import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from '../services/transactions.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { toTransactionResponse } from '../mappers/transaction.mapper';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly tx: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List transactions for current user' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: Request & { user?: { sub?: string } }) {
    const userId = req.user?.sub as string;
    const items = await this.tx.listAll(userId);
    return { success: true, data: items.map((i) => toTransactionResponse(i)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by id' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async get(@Req() req: Request & { user?: { sub?: string } }, @Param('id') id: string) {
    const userId = req.user?.sub as string;
    const t = await this.tx.getById(userId, id);
    return { success: true, data: toTransactionResponse(t) };
  }

  @Post()
  @ApiOperation({ summary: 'Create transaction' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: Request & { user?: { sub?: string } }, @Body() body: CreateTransactionDto) {
    const userId = req.user?.sub as string;
    const created = await this.tx.create(userId, { ...body, amount_cents: BigInt(body.amount_cents), transaction_date: new Date(body.transaction_date) } as any);
    return { success: true, data: toTransactionResponse(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update transaction' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async update(@Req() req: Request & { user?: { sub?: string } }, @Param('id') id: string, @Body() body: UpdateTransactionDto) {
    const userId = req.user?.sub as string;
    const prepared: any = { ...body };
    if (body.amount_cents !== undefined) prepared.amount_cents = BigInt(body.amount_cents);
    if (body.transaction_date !== undefined) prepared.transaction_date = new Date(body.transaction_date);
    const updated = await this.tx.update(userId, id, prepared);
    return { success: true, data: toTransactionResponse(updated) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete transaction' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: Request & { user?: { sub?: string } }, @Param('id') id: string) {
    const userId = req.user?.sub as string;
    await this.tx.softDelete(userId, id);
    return { success: true };
  }
}
