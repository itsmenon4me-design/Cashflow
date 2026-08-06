import { ApiProperty } from '@nestjs/swagger';

class CategoryItemDto {
  @ApiProperty()
  categoryId: string;
  @ApiProperty()
  categoryName: string | null;
  @ApiProperty()
  totalAmount: number;
  @ApiProperty()
  percentage: number;
  @ApiProperty()
  transactionCount: number;
}

export class CategoryBreakdownResponseDto {
  @ApiProperty()
  type: string;
  @ApiProperty()
  total: number;
  @ApiProperty({ type: [CategoryItemDto] })
  categories: CategoryItemDto[];
}
