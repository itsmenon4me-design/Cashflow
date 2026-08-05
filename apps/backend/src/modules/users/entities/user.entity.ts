export type UserStatus =
  'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export class UserEntity {
  id!: string;
  created_at!: Date;
  updated_at!: Date;
  deleted_at?: Date | null;

  email!: string;
  username!: string;
  full_name!: string;
  password_hash!: string;
  avatar_url?: string | null;
  phone_number?: string | null;
  status!: UserStatus;
  email_verified_at?: Date | null;
  last_login_at?: Date | null;

  // Verification / Reset fields
  verification_token_hash?: string | null;
  verification_token_expires_at?: Date | null;

  password_reset_token_hash?: string | null;
  password_reset_expires_at?: Date | null;
  password_reset_requested_at?: Date | null;

  role_id?: string | null;
  role_code?: string | null;
}
