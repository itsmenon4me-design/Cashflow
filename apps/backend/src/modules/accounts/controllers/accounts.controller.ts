import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountsService } from '../services/accounts.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { toAccountResponse } from '../mappers/account.mapper';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { BalanceService } from '../services/balance.service';
import { Request } from 'express';

@ApiTags('Accounts')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly balance: BalanceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List accounts for current user' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser('sub') userId: string, @Query('currency') currency?: string) {
    const items = await this.accounts.listAll(userId, currency);
    return { success: true, data: items.map((i) => toAccountResponse(i)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by id' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async get(@CurrentUser('sub') userId: string, @Param('id') id: string, @Query('currency') currency?: string) {
    const acc = await this.accounts.getById(userId, id, currency);
    return { success: true, data: toAccountResponse(acc) };
  }

  @Post()
  @ApiOperation({ summary: 'Create new account' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('sub') userId: string,
    @Body() body: CreateAccountDto,
    @Query('currency') currency?: string,
  ) {
    // Enforce active dashboard currency: override body.currency if currency query is provided
    if (currency) (body as any).currency = currency;
    const created = await this.accounts.create(userId, body);
    return { success: true, data: toAccountResponse(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update account' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: UpdateAccountDto,
    @Query('currency') currency?: string,
  ) {
    const updated = await this.accounts.update(userId, id, body, currency);
    return { success: true, data: toAccountResponse(updated) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete account' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async delete(@CurrentUser('sub') userId: string, @Param('id') id: string, @Query('currency') currency?: string) {
    await this.accounts.softDelete(userId, id, currency);
    return { success: true };
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set default account' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async setDefault(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('currency') currency?: string,
  ) {
    await this.accounts.setDefault(userId, id, currency);
    return { success: true };
  }

  @Post('recalculate')
  @ApiOperation({ summary: 'Recalculate all account balances (SUPER_ADMIN)' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async recalculateAll() {
    await this.accounts.recalculateAll();
    return { success: true };
  }
}
