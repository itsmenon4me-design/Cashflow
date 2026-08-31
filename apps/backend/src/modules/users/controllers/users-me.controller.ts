import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DeleteMyAccountDto } from '../dto/delete-my-account.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@Controller('users/me')
export class UsersMeController {
  constructor(private readonly users: UsersService) {}

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Permanently delete the authenticated user and all related data',
  })
  @ApiResponse({ status: 200 })
  async deleteOwnAccount(
    @CurrentUser('sub') userId: string,
    @CurrentUser('email') currentEmail: string | undefined,
    @Body() body: DeleteMyAccountDto,
  ): Promise<{ success: true }> {
    if (!currentEmail) {
      throw ErrorService.create(
        ErrorCode.UNAUTHORIZED,
        'Missing authenticated email',
      );
    }
    await this.users.deleteOwnAccount(userId, currentEmail, body);
    return { success: true };
  }
}
