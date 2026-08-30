import { UserEntity } from '../entities/user.entity';

export interface IUsersRepository {
  create(user: Partial<UserEntity>): Promise<UserEntity>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  update(id: string, updates: Partial<UserEntity>): Promise<UserEntity>;
  softDelete(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
  count(): Promise<number>;
  findAll(): Promise<UserEntity[]>;
}
