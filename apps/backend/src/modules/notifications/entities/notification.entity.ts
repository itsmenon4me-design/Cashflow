export interface NotificationEntity {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: Date | null;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
}
