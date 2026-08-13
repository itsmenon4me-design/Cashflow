import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CURRENCIES, LANGUAGES, THEMES } from '../constants/settings.constants';

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({ enum: THEMES, description: 'Theme preference' })
  @IsOptional()
  @IsIn(THEMES)
  theme?: string;

  @ApiPropertyOptional({ enum: LANGUAGES, description: 'Language preference' })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: string;

  @ApiPropertyOptional({ enum: CURRENCIES, description: 'Default currency' })
  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: string;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Notification preferences',
  })
  @IsOptional()
  @IsObject()
  notification_preferences?: Record<string, unknown>;
}
