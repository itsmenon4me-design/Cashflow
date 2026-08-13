import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class SuggestCategoryRequestDto {
  @ApiPropertyOptional({
    description: 'Transaction description or merchant details',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Transaction merchant or payee name' })
  @IsString()
  @IsOptional()
  merchant?: string;

  @ApiPropertyOptional({
    description: 'Transaction amount in the local currency',
    type: Number,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'] })
  @IsEnum(['INCOME', 'EXPENSE'])
  transaction_type!: 'INCOME' | 'EXPENSE';
}
