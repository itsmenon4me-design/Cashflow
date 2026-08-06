import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { AuthDataDto } from './auth-response.dto';

export class LoginResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty({ required: false, type: AuthDataDto })
  data?: AuthDataDto;

  @ApiProperty({ required: false, type: UserResponseDto })
  user?: UserResponseDto;
}
