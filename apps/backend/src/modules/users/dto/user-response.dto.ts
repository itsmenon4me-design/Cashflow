import { ApiProperty } from '@nestjs/swagger';
import type { UserStatus } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  full_name!: string;

  @ApiProperty({ required: false })
  avatar_url?: string | null;

  @ApiProperty({ required: false })
  phone_number?: string | null;

  @ApiProperty({
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'],
  })
  status!: UserStatus;

  @ApiProperty({ required: false })
  email_verified_at?: string | null;

  @ApiProperty({ required: false })
  last_login_at?: string | null;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;
}
