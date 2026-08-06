/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ICategoriesRepository } from './categories.repository.interface';
import { CategoryEntity } from '../entities/category.entity';

type CatRec = any;

@Injectable()
export class PrismaCategoriesRepository implements ICategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: CatRec): CategoryEntity {
    const c = new CategoryEntity();

    c.id = rec.id;
    c.user_id = rec.user_id;
    c.name = rec.name;
    c.type = rec.type;

    c.icon = rec.icon ?? null;
    c.color = rec.color ?? null;
    c.description = rec.description ?? null;
    c.parent_category_id = rec.parent_category_id ?? null;

    c.is_system = rec.is_system;
    c.is_active = rec.is_active;

    c.created_at = rec.created_at;
    c.updated_at = rec.updated_at;
    c.deleted_at = rec.deleted_at ?? null;

    return c;
  }

  async create(input: Partial<CategoryEntity>): Promise<CategoryEntity> {
    const data: any = {
      ...input,
    };

    const rec = await this.prisma.category.create({
      data,
    });

    return this.map(rec);
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    const rec = await this.prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!rec || rec.deleted_at) {
      return null;
    }

    return this.map(rec);
  }

  async findAllByUser(userId: string): Promise<CategoryEntity[]> {
    const recs: CatRec[] = await this.prisma.category.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return recs.map((r) => this.map(r));
  }

  async findByUserAndNameAndType(
    userId: string,
    name: string,
    type: string,
  ): Promise<CategoryEntity | null> {
    const rec = await this.prisma.category.findFirst({
      where: {
        user_id: userId,
        name,
        type,
        deleted_at: null,
      },
    });

    return rec ? this.map(rec) : null;
  }

  async update(
    id: string,
    updates: Partial<CategoryEntity>,
  ): Promise<CategoryEntity> {
    const data: any = {
      ...updates,
    };

    const rec = await this.prisma.category.update({
      where: {
        id,
      },
      data,
    });

    return this.map(rec);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.category.update({
      where: {
        id,
      },
      data: {
        deleted_at: new Date(),
      },
    });
  }

  async findByType(userId: string, type: string): Promise<CategoryEntity[]> {
    const recs: CatRec[] = await this.prisma.category.findMany({
      where: {
        user_id: userId,
        type,
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return recs.map((r) => this.map(r));
  }
}
