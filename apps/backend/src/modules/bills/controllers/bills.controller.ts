import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { BillsService } from '../services/bills.service';
import { CreateBillDto } from '../dto/create-bill.dto';
import { UpdateBillDto } from '../dto/update-bill.dto';
import { UpcomingBillsQueryDto } from '../dto/upcoming-bills-query.dto';
import { toBillResponse } from '../mappers/bill.mapper';

@ApiTags('Bills')
@Controller('bills')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Get()
  @ApiOperation({ summary: 'List bills for current user' })
  async list(@CurrentUser('sub') userId: string, @Query('currency') currency?: string) {
    const items = currency ? await this.bills.list(userId, currency) : await this.bills.list(userId);
    return { success: true, data: items.map((i) => toBillResponse(i)) };
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'List upcoming bills for current user' })
  async upcoming(
    @CurrentUser('sub') userId: string,
    @Query() query: UpcomingBillsQueryDto,
    @Query('currency') currency?: string,
  ) {
    const items = currency ? await this.bills.upcoming(userId, query.from, query.to, currency) : await this.bills.upcoming(userId, query.from, query.to);
    return { success: true, data: items.map((i) => toBillResponse(i)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bill by id' })
  async get(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('currency') currency?: string,
  ) {
    return {
      success: true,
      data: toBillResponse(currency ? await this.bills.getById(userId, id, currency) : await this.bills.getById(userId, id)),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create bill' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() body: CreateBillDto,
    @Query('currency') currency?: string,
  ) {
    return {
      success: true,
      data: toBillResponse(await this.bills.create(userId, body, currency)),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update bill' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateBillDto,
    @Query('currency') currency?: string,
  ) {
    return {
      success: true,
      data: toBillResponse(await this.bills.update(userId, id, body, currency)),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete bill' })
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('currency') currency?: string,
  ) {
    await this.bills.softDelete(userId, id, currency);
    return { success: true };
  }
}
