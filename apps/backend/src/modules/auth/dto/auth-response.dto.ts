import { ApiProperty } from '@nestjs/swagger';

export class AuthDataDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  tokenType!: string;

  @ApiProperty()
  expiresIn!: number;
}

export class AuthResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty({ required: false, type: AuthDataDto })
  data?: AuthDataDto;
}
