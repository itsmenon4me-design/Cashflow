import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BudgetsService } from '../services/budgets.service';
import { CreateBudgetDto } from '../dto/create-budget.dto';
import { UpdateBudgetDto } from '../dto/update-budget.dto';
import { toBudgetResponse } from '../mappers/budget.mapper';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Budgets')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'List budgets for current user' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser('sub') userId: string,
    @Query('currency') currency?: string,
  ) {
    const items = await this.budgets.listAll(userId, currency);
    return { success: true, data: items.map((i) => toBudgetResponse(i)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get budget by id' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async get(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('currency') currency?: string,
  ) {
    const b = await this.budgets.getById(userId, id, currency);
    return { success: true, data: toBudgetResponse(b) };
  }

  @Post()
  @ApiOperation({ summary: 'Create budget' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('sub') userId: string,
    @Body() body: CreateBudgetDto,
  ) {
    const created = await this.budgets.create(userId, body);
    return { success: true, data: toBudgetResponse(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update budget' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: UpdateBudgetDto,
    @Query('currency') currency?: string,
  ) {
    const updated = await this.budgets.update(userId, id, body, currency);
    return { success: true, data: toBudgetResponse(updated) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete budget' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('currency') currency?: string,
  ) {
    await this.budgets.softDelete(userId, id, currency);
    return { success: true };
  }
}
