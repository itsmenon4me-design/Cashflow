export class SessionEntity {
  id!: string;
  user_id!: string;
  refresh_token_id!: string;
  device_name?: string | null;
  device_type?: string | null;
  browser?: string | null;
  operating_system?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  last_activity_at!: Date;
  expires_at!: Date;
  revoked_at?: Date | null;
  created_at!: Date;
  updated_at!: Date;
}
