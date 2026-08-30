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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { DeleteMyAccountDto } from '../dto/delete-my-account.dto';
import { toUserResponse } from '../mappers/user.mapper';
import { UserResponseDto } from '../dto/user-response.dto';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'List all users (ADMIN only)' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  async list(): Promise<UserResponseDto[]> {
    const items = await this.users.listAll();
    return items.map((u) => toUserResponse(u));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get own user by id' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<UserResponseDto | null> {
    if (userId !== id) {
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    }
    const u = await this.users.findById(id);
    if (!u) return null;
    return toUserResponse(u);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Create user (SUPER_ADMIN only)' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  async create(@Body() body: CreateUserDto): Promise<UserResponseDto> {
    const u = await this.users.create(body);
    return toUserResponse(u);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Update own user' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ): Promise<UserResponseDto> {
    if (userId !== id) {
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    }
    const u = await this.users.update(id, body);
    return toUserResponse(u);
  }

  @Post('me/delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Permanently delete the authenticated user and all related data' })
  @ApiResponse({ status: 200 })
  async deleteOwnAccount(
    @CurrentUser('sub') userId: string,
    @CurrentUser('email') currentEmail: string | undefined,
    @Body() body: DeleteMyAccountDto,
  ): Promise<{ success: true }> {
    if (!currentEmail) {
      throw ErrorService.create(ErrorCode.UNAUTHORIZED, 'Missing authenticated email');
    }
    await this.users.deleteOwnAccount(userId, currentEmail, body);
    return { success: true };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Soft delete own user' })
  @ApiResponse({ status: 200 })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    if (userId !== id) {
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    }
    await this.users.softDelete(id);
  }
}
