import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateTransferDto } from '../dto/create-transfer.dto';
import { TransfersService } from '../services/transfers.service';
import { TransferResponseDto } from '../dto/transfer-response.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('transfers')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a transfer between accounts' })
  @ApiResponse({ status: 201, type: TransferResponseDto })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() body: CreateTransferDto,
  ) {
    if (!userId) throw new Error('Unauthorized');
    const result = await this.service.create(userId, {
      source_account_id: body.source_account_id,
      destination_account_id: body.destination_account_id,
      amount_cents: BigInt(body.amount_cents),
      reference: body.reference ?? null,
      transaction_date: body.transaction_date
        ? new Date(body.transaction_date)
        : undefined,
      note: body.note ?? null,
    });
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'List transfers for current user' })
  @ApiResponse({ status: 200, type: [TransferResponseDto] })
  async list(@CurrentUser('sub') userId: string) {
    if (!userId) throw new Error('Unauthorized');
    return this.service.list(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transfer by id (transfer_group_id)' })
  @ApiResponse({ status: 200, type: TransferResponseDto })
  async findById(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    if (!userId) throw new Error('Unauthorized');
    return this.service.findById(userId, id);
  }
}
