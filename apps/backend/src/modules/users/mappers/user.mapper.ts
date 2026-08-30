import { UserEntity } from '../entities/user.entity';
import { UserResponseDto } from '../dto/user-response.dto';

export function toUserResponse(
  u: UserEntity,
  options: { includePasswordCapability?: boolean } = {},
): UserResponseDto {
  const response: UserResponseDto = {
    id: u.id,
    email: u.email,
    username: u.username,
    full_name: u.full_name,
    avatar_url: u.avatar_url ?? null,
    phone_number: u.phone_number ?? null,
    status: u.status,
    email_verified_at: u.email_verified_at
      ? u.email_verified_at.toISOString()
      : null,
    last_login_at: u.last_login_at ? u.last_login_at.toISOString() : null,
    created_at: u.created_at.toISOString(),
    updated_at: u.updated_at.toISOString(),
  };

  if (options.includePasswordCapability) {
    response.has_manual_password = u.has_manual_password ?? null;
  }

  return response;
}
