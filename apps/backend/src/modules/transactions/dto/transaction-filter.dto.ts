import {
  IsOptional,
  IsString,
  IsIn,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsBooleanString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionFilterDto {
  @ApiPropertyOptional({
    description: 'Search keyword (note, reference, amount, type, id)',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Account id to filter' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Category id to filter' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['INCOME', 'EXPENSE'] })
  @IsOptional()
  @IsIn(['INCOME', 'EXPENSE'])
  type?: 'INCOME' | 'EXPENSE';

  @ApiPropertyOptional({ description: 'From transaction date (ISO)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'To transaction date (ISO)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Minimum amount in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Currency code (filters account currency)',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Has attachment: true/false' })
  @IsOptional()
  @IsBooleanString()
  hasAttachment?: string;

  // Sorting
  @ApiPropertyOptional({ description: 'sortBy: date|amount|createdAt' })
  @IsOptional()
  @IsIn(['date', 'amount', 'createdAt'])
  sortBy?: 'date' | 'amount' | 'createdAt';

  @ApiPropertyOptional({ description: 'sortOrder: asc|desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

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
}
