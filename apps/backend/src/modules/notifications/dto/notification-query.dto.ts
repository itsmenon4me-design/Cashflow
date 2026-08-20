import { IsInt, IsOptional, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NOTIFICATION_TYPES } from '../constants/notification.constants';
import { SUPPORTED_CURRENCIES } from '../../../common/types/money';

export class NotificationQueryDto {
  @ApiPropertyOptional({
    description:
      'Ledger currency scope: only notifications carrying this currency in their metadata',
    enum: SUPPORTED_CURRENCIES,
  })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by unread status: true|false',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  unread?: string;

  @ApiPropertyOptional({
    description: 'Filter by notification type',
    enum: NOTIFICATION_TYPES,
  })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: string;
}
