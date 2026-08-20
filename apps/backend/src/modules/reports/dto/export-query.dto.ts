import { SUPPORTED_CURRENCIES } from '../../../common/types/money';
import { IsIn, IsOptional, IsInt, Min, Max, IsISO8601, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportQueryDto {
  @ApiProperty({ enum: ['monthly', 'category', 'trend'] })
  @IsIn(['monthly', 'category', 'trend'])
  type: 'monthly' | 'category' | 'trend';

  @ApiProperty({ enum: ['csv'] })
  @IsIn(['csv'])
  format: 'csv';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Financial dataset currency scope for report export.',
    enum: SUPPORTED_CURRENCIES,
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES as string[])
  currency?: string;
}
