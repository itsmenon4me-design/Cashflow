import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  user_id!: string;

  @ApiProperty({ nullable: true })
  device_name?: string | null;

  @ApiProperty({ nullable: true })
  device_type?: string | null;

  @ApiProperty({ nullable: true })
  browser?: string | null;

  @ApiProperty({ nullable: true })
  operating_system?: string | null;

  @ApiProperty({ nullable: true })
  ip_address?: string | null;

  @ApiProperty({ nullable: true })
  city?: string | null;

  @ApiProperty({ nullable: true })
  country?: string | null;

  @ApiProperty({ nullable: true })
  user_agent?: string | null;

  @ApiProperty()
  last_activity_at!: Date;

  @ApiProperty()
  expires_at!: Date;

  @ApiProperty({ nullable: true })
  revoked_at?: Date | null;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;
}
