import { Injectable, Logger } from '@nestjs/common';
import { PrismaCategoriesRepository } from '../repositories/prisma-categories.repository';
import { CategoryEntity } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import {
  AuditAction,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly repo: PrismaCategoriesRepository,
    private readonly audit: AuditLogService,
  ) {}

  async create(
    userId: string,
    input: Partial<CategoryEntity> | CreateCategoryDto,
  ): Promise<CategoryEntity> {
    if (!input.name)
      throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Name is required');
    if (!input.type)
      throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Type is required');

    // unique per user & type
    const existing = await this.repo.findByUserAndNameAndType(
      userId,
      input.name,
      input.type,
    );
    if (existing)
      throw ErrorService.create(ErrorCode.CONFLICT, 'Category already exists');

    const incoming = input as Partial<CategoryEntity> & CreateCategoryDto;

    const name = String(incoming.name);
    const typeVal = incoming.type;
    const icon = incoming.icon ?? null;
    const color = incoming.color ?? null;
    const description = incoming.description ?? null;
    const parentCategoryId = incoming.parent_category_id ?? null;
    const isActive =
      typeof incoming.is_active === 'boolean' ? incoming.is_active : true;

    const c: Partial<CategoryEntity> = {
      user_id: userId,
      name,
      type: typeVal,
      icon,
      color,
      description,
      parent_category_id: parentCategoryId,
      is_system: false,
      is_active: isActive,
    };

    const created = await this.repo.create(c);

    void this.audit.record({
      userId,
      action: AuditAction.CATEGORY_CREATED,
      module: AuditModule.CATEGORY,
      entityType: 'Category',
      entityId: created.id,
    });
    this.logger.log(`Category Created user=${userId} id=${created.id}`);
    return created;
  }

  async getById(userId: string, id: string): Promise<CategoryEntity> {
    const c = await this.repo.findById(id);
    if (!c)
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Category not found');
    if (c.user_id !== userId && !c.is_system)
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    return c;
  }

  async listAll(userId: string): Promise<CategoryEntity[]> {
    return this.repo.findAllByUser(userId);
  }

  async listByType(userId: string, type: string): Promise<CategoryEntity[]> {
    return this.repo.findByType(userId, type);
  }

  async update(
    userId: string,
    id: string,
    updates: Partial<CategoryEntity>,
  ): Promise<CategoryEntity> {
    const c = await this.getById(userId, id);
    if (c.is_system)
      throw ErrorService.create(
        ErrorCode.FORBIDDEN,
        'System category is read-only',
      );

    if (updates.name && updates.name !== c.name) {
      const other = await this.repo.findByUserAndNameAndType(
        userId,
        updates.name,
        updates.type ?? c.type,
      );
      if (other)
        throw ErrorService.create(
          ErrorCode.CONFLICT,
          'Category name already exists',
        );
    }

    const updated = await this.repo.update(id, updates);
    void this.audit.record({
      userId,
      action: AuditAction.CATEGORY_UPDATED,
      module: AuditModule.CATEGORY,
      entityType: 'Category',
      entityId: updated.id,
    });
    this.logger.log(`Category Updated user=${userId} id=${updated.id}`);
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const c = await this.getById(userId, id);
    if (c.is_system)
      throw ErrorService.create(
        ErrorCode.FORBIDDEN,
        'System categories cannot be deleted',
      );
    await this.repo.softDelete(id);
    void this.audit.record({
      userId,
      action: AuditAction.CATEGORY_DELETED,
      module: AuditModule.CATEGORY,
      entityType: 'Category',
      entityId: id,
    });
    this.logger.log(`Category Deleted user=${userId} id=${id}`);
  }
}
