import { ApiProperty } from '@nestjs/swagger';

export class StandardErrorDetail {
  @ApiProperty({ example: 'email', description: 'Field name' })
  field!: string;

  @ApiProperty({
    example: 'Email is invalid',
    description: 'Error message for the field',
  })
  message!: string;
}

export class StandardErrorResponse {
  @ApiProperty({ example: false })
  success!: boolean;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ example: 'ERR_INVALID_INPUT', required: false })
  errorCode?: string;

  @ApiProperty({ type: [StandardErrorDetail], required: false })
  errors?: StandardErrorDetail[];

  @ApiProperty({ example: new Date().toISOString() })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/auth/login' })
  path!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  requestId?: string;
}
