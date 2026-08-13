import { UserSettingsEntity } from '../entities/user-settings.entity';

export interface UserSettingsCreateData {
  user_id: string;
  theme: string;
  language: string;
  currency: string;
  timezone?: string | null;
  notification_preferences?: object;
}

export interface UserSettingsUpdateData {
  theme?: string;
  language?: string;
  currency?: string;
  timezone?: string | null;
  notification_preferences?: object;
}

export interface UserSettingsRepository {
  findByUserId(userId: string): Promise<UserSettingsEntity | null>;
  create(data: UserSettingsCreateData): Promise<UserSettingsEntity>;
  updateByUserId(userId: string, data: UserSettingsUpdateData): Promise<void>;
}
