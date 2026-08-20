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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SavingGoalsService } from '../services/saving-goals.service';
import { CreateSavingGoalDto } from '../dto/create-saving-goal.dto';
import { UpdateSavingGoalDto } from '../dto/update-saving-goal.dto';
import { toSavingGoalResponse } from '../mappers/saving-goal.mapper';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Saving Goals')
@Controller('saving-goals')
export class SavingGoalsController {
  constructor(private readonly goals: SavingGoalsService) {}

  @Get()
  @ApiOperation({ summary: 'List saving goals for current user' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser('sub') userId: string,
    @Query('currency') currency?: string,
  ) {
    const items = await this.goals.listAll(userId, currency);
    return { success: true, data: items.map((i) => toSavingGoalResponse(i)) };
  }

  @Get('overview')
  @ApiOperation({ summary: 'Saving goals overview for current user' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async overview(@CurrentUser('sub') userId: string, @Query('currency') currency?: string) {
    return { success: true, data: await this.goals.overview(userId, currency) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get saving goal by id' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async get(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('currency') currency?: string,
  ) {
    const goal = await this.goals.getById(userId, id, currency);
    return { success: true, data: toSavingGoalResponse(goal) };
  }

  @Post()
  @ApiOperation({ summary: 'Create saving goal' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('sub') userId: string,
    @Body() body: CreateSavingGoalDto,
    @Query('currency') currency?: string,
  ) {
    const created = await this.goals.create(userId, body, currency);
    return { success: true, data: toSavingGoalResponse(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update saving goal' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: UpdateSavingGoalDto,
    @Query('currency') currency?: string,
  ) {
    const updated = await this.goals.update(userId, id, body, currency);
    return { success: true, data: toSavingGoalResponse(updated) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete saving goal' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('currency') currency?: string,
  ) {
    await this.goals.softDelete(userId, id, currency);
    return { success: true };
  }
}
