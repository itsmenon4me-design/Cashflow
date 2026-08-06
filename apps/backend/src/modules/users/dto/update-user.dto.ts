import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional, Length } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @Length(2, 100)
  full_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  avatar_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  phone_number?: string;
}
