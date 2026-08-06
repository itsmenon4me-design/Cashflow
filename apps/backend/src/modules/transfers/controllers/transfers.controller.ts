import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
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
import type { Request } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

// AuthenticatedRequest has user typed from JwtPayload with optional id/sub
interface AuthenticatedRequest extends Request {
  user: JwtPayload & { id?: string; sub?: string };
}

@ApiTags('transfers')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('api/v1/transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a transfer between accounts' })
  @ApiResponse({ status: 201, type: TransferResponseDto })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateTransferDto,
  ) {
    const userId = req.user?.id ?? req.user?.sub;
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
  async list(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new Error('Unauthorized');
    return this.service.list(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transfer by id (transfer_group_id)' })
  @ApiResponse({ status: 200, type: TransferResponseDto })
  async findById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new Error('Unauthorized');
    return this.service.findById(userId, id);
  }
}
