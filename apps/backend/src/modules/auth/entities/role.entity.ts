export class RoleEntity {
  id!: string;
  code!: string;
  name!: string;
  description?: string | null;
  is_system!: boolean;
  created_at!: Date;
  updated_at!: Date;
}
