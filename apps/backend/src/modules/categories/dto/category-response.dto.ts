import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty({ required: false })
  icon?: string | null;

  @ApiProperty({ required: false })
  color?: string | null;

  @ApiProperty({ required: false })
  description?: string | null;

  @ApiProperty()
  is_system!: boolean;

  @ApiProperty()
  is_active!: boolean;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;
}
