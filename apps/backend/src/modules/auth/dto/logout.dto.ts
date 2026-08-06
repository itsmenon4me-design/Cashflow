import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({ required: false })
  reason?: string;
}
