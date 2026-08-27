import { IsIn, IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrendQueryDto {
  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'] })
  @IsIn(['daily', 'weekly', 'monthly'])
  type: 'daily' | 'weekly' | 'monthly';

  @ApiProperty({ description: 'Start Date (ISO 8601)' })
  @IsISO8601()
  startDate: string;

  @ApiProperty({ description: 'End Date (ISO 8601)' })
  @IsISO8601()
  endDate: string;
}
