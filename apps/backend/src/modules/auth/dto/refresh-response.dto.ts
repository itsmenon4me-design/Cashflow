import { ApiProperty } from '@nestjs/swagger';

export class RefreshResponseDataDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty()
  tokenType!: string;

  @ApiProperty()
  expiresIn!: number;
}

export class RefreshResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty({ required: false, type: RefreshResponseDataDto })
  data?: RefreshResponseDataDto;
}
