import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, Length } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'One-time password reset token from the reset email',
  })
  @IsNotEmpty({ message: 'token must not be empty' })
  @Length(32, 512, { message: 'token must be a valid reset token' })
  token!: string;

  @ApiProperty({ description: 'User id from the reset link' })
  @IsNotEmpty({ message: 'id must not be empty' })
  @IsUUID('4', { message: 'id must be a valid UUID' })
  id!: string;

  @ApiProperty({
    description: 'New password (must be between 12 and 128 characters)',
  })
  @IsNotEmpty({ message: 'new_password must not be empty' })
  @Length(12, 128, {
    message: 'new_password must be between 12 and 128 characters',
  })
  new_password!: string;
}
