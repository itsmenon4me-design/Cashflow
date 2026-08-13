import { ApiProperty } from '@nestjs/swagger';

export class BudgetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  category_id!: string;

  @ApiProperty({ required: false })
  category_name?: string | null;

  @ApiProperty({ description: 'Budget limit in cents' })
  budget_amount_cents!: string;

  @ApiProperty()
  month!: number;

  @ApiProperty()
  year!: number;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;
}
