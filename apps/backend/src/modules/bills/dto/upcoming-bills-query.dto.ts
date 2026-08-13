import { IsISO8601, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpcomingBillsQueryDto {
  @ApiPropertyOptional({ description: 'Start of the window (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End of the window (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
