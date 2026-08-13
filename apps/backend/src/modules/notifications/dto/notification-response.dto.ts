import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification id' })
  id: string;

  @ApiProperty({ description: 'Owner user id' })
  user_id: string;

  @ApiProperty({ description: 'Notification type' })
  type: string;

  @ApiProperty({ description: 'Notification title' })
  title: string;

  @ApiProperty({ description: 'Notification message' })
  message: string;

  @ApiProperty({ description: 'Read status' })
  is_read: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Read timestamp',
  })
  read_at: Date | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'Extra metadata',
  })
  metadata: unknown;

  @ApiProperty({ description: 'Created at' })
  created_at: Date;

  @ApiProperty({ description: 'Updated at' })
  updated_at: Date;
}
