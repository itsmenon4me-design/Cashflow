import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class DeleteMyAccountDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'CurrentPassword123!' })
  @IsOptional()
  @Length(6, 128)
  password?: string;
}
