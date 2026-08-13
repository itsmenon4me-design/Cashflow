import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestCategoryResponseDto {
  @ApiProperty()
  category_id!: string;

  @ApiProperty()
  category_name!: string;

  @ApiProperty({
    description: 'Confidence score normalized between 0.0 and 1.0',
  })
  confidence!: number;

  @ApiPropertyOptional({
    description: 'A brief explanation for the suggestion',
  })
  reason?: string | null;
}
