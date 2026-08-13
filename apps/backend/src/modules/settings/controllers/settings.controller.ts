import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UserSettingsService } from '../services/user-settings.service';
import { UpdateUserSettingsDto } from '../dto/update-user-settings.dto';
import { UserSettingsResponseDto } from '../dto/user-settings-response.dto';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class SettingsController {
  constructor(private readonly settings: UserSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get settings of the authenticated user' })
  @ApiResponse({ status: 200, type: UserSettingsResponseDto })
  async get(@CurrentUser('sub') userId: string) {
    return { success: true, data: await this.settings.getSettings(userId) };
  }

  @Patch()
  @ApiOperation({ summary: 'Update settings of the authenticated user' })
  @ApiResponse({ status: 200, type: UserSettingsResponseDto })
  async update(
    @CurrentUser('sub') userId: string,
    @Body() body: UpdateUserSettingsDto,
  ) {
    return {
      success: true,
      data: await this.settings.updateSettings(userId, body),
    };
  }
}
