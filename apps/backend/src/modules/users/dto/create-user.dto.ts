import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Unique username',
    example: 'jdoe',
    required: false,
  })
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_.-]{3,30}$/)
  username?: string;

  @ApiProperty({ description: 'Full name', example: 'John Doe' })
  @IsNotEmpty()
  @Length(2, 100)
  full_name!: string;

  @ApiProperty({
    description: 'Plain text password (will be hashed)',
    example: 'S3cur3P@ssw0rd!',
  })
  @IsNotEmpty()
  @Length(8, 128)
  password!: string;

  @ApiProperty({ description: 'Avatar URL', required: false })
  @IsOptional()
  avatar_url?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsOptional()
  phone_number?: string;
}
