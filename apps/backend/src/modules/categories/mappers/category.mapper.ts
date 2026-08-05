import { CategoryEntity } from '../entities/category.entity';
import { CategoryResponseDto } from '../dto/category-response.dto';

export function toCategoryResponse(c: CategoryEntity): CategoryResponseDto {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon ?? null,
    color: c.color ?? null,
    description: c.description ?? null,
    is_system: c.is_system,
    is_active: c.is_active,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}
