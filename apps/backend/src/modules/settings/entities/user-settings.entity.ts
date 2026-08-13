export interface UserSettingsEntity {
  id: string;
  user_id: string;
  theme: string;
  language: string;
  currency: string;
  timezone: string | null;
  notification_preferences: unknown;
  created_at: Date;
  updated_at: Date;
}
