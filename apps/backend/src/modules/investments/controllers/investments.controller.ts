import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvestmentsService } from '../services/investments.service';
import { CreateInvestmentDto } from '../dto/create-investment.dto';
import { UpdateInvestmentDto } from '../dto/update-investment.dto';
import { toInvestmentResponse } from '../mappers/investment.mapper';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Investments')
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List investments for current user' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser('sub') userId: string) {
    const items = await this.investments.listAll(userId);
    return { success: true, data: items.map((i) => toInvestmentResponse(i)) };
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Investment overview (portfolio totals & allocation)',
  })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async overview(@CurrentUser('sub') userId: string) {
    return { success: true, data: await this.investments.overview(userId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get investment by id' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async get(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const item = await this.investments.getById(userId, id);
    return { success: true, data: toInvestmentResponse(item) };
  }

  @Post()
  @ApiOperation({ summary: 'Create investment' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('sub') userId: string,
    @Body() body: CreateInvestmentDto,
  ) {
    const created = await this.investments.create(userId, body);
    return { success: true, data: toInvestmentResponse(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update investment' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: UpdateInvestmentDto,
  ) {
    const updated = await this.investments.update(userId, id, body);
    return { success: true, data: toInvestmentResponse(updated) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete investment' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async delete(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.investments.softDelete(userId, id);
    return { success: true };
  }
}
