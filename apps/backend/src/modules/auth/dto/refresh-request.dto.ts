import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RefreshRequestDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsNotEmpty()
  refreshToken!: string;
}
