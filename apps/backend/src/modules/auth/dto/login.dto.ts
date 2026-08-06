import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'S3cur3P@ssw0rd!' })
  @IsNotEmpty()
  @Length(12, 128)
  password!: string;
}
