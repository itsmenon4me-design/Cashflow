import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSettingsResponseDto {
  @ApiProperty({ description: 'Settings record id' })
  id: string;

  @ApiProperty({ description: 'Owner user id' })
  user_id: string;

  @ApiProperty({
    description: 'Theme preference',
    enum: ['system', 'light', 'dark'],
  })
  theme: string;

  @ApiProperty({ description: 'Language preference', enum: ['id', 'en'] })
  language: string;

  @ApiProperty({ description: 'Default currency' })
  currency: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Timezone',
  })
  timezone: string | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'Notification preferences',
  })
  notification_preferences: unknown;

  @ApiProperty({ description: 'Created at' })
  created_at: Date;

  @ApiProperty({ description: 'Updated at' })
  updated_at: Date;
}
