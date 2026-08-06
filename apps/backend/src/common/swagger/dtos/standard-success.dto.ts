import { ApiProperty } from '@nestjs/swagger';

export class StandardSuccessResponse<T = unknown> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'OK' })
  message!: string;

  @ApiProperty({ example: {}, required: false })
  data?: T;

  @ApiProperty({ example: new Date().toISOString() })
  timestamp!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  requestId?: string;
}
