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
} from '@nestjs/common';
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

interface RequestWithUser extends Request {
  user?: { sub?: string };
}

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
  async list(@Req() req: Request & { user?: { sub?: string } }) {
    const userId = req.user?.sub as string;
    const items = await this.accounts.listAll(userId);
    return { success: true, data: items.map((i) => toAccountResponse(i)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by id' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async get(
    @Req() req: Request & { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub as string;
    const acc = await this.accounts.getById(userId, id);
    return { success: true, data: toAccountResponse(acc) };
  }

  @Post()
  @ApiOperation({ summary: 'Create new account' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: RequestWithUser, @Body() body: CreateAccountDto) {
    const userId = req.user?.sub as string;
    const created = await this.accounts.create(userId, body);
    return { success: true, data: toAccountResponse(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update account' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateAccountDto,
  ) {
    const userId = req.user?.sub as string;
    const updated = await this.accounts.update(userId, id, body);
    return { success: true, data: toAccountResponse(updated) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete account' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async delete(
    @Req() req: Request & { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub as string;
    await this.accounts.softDelete(userId, id);
    return { success: true };
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set default account' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async setDefault(
    @Req() req: Request & { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub as string;
    await this.accounts.setDefault(userId, id);
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
