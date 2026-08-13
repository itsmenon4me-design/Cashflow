import { UserSettingsEntity } from '../entities/user-settings.entity';
import { UserSettingsResponseDto } from '../dto/user-settings-response.dto';

export function toUserSettingsResponse(
  settings: UserSettingsEntity,
): UserSettingsResponseDto {
  return {
    id: settings.id,
    user_id: settings.user_id,
    theme: settings.theme,
    language: settings.language,
    currency: settings.currency,
    timezone: settings.timezone,
    notification_preferences: settings.notification_preferences,
    created_at: settings.created_at,
    updated_at: settings.updated_at,
  };
}
