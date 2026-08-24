import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaCategoriesRepository } from '../repositories/prisma-categories.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';

describe('CategoriesService — system categories are editable and deletable', () => {
  let service: CategoriesService;

  const repoMock = {
    findById: jest.fn(),
    findAllByUser: jest.fn(),
    findByType: jest.fn(),
    findByUserAndNameAndType: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
  const auditMock = { record: jest.fn().mockResolvedValue(undefined) };

  const systemCategory = {
    id: 'cat-sys',
    user_id: 'u1',
    name: 'Food',
    type: 'EXPENSE',
    icon: null,
    color: null,
    description: null,
    parent_category_id: null,
    is_system: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaCategoriesRepository, useValue: repoMock },
        { provide: AuditLogService, useValue: auditMock },
      ],
    }).compile();
    service = module.get<CategoriesService>(CategoriesService);
  });

  it('update: allows renaming a system (seed/default) category', async () => {
    repoMock.findById.mockResolvedValue({ ...systemCategory });
    repoMock.findByUserAndNameAndType.mockResolvedValue(null);
    repoMock.update.mockResolvedValue({ ...systemCategory, name: 'Makanan' });

    const updated = await service.update('u1', 'cat-sys', { name: 'Makanan' });

    expect(updated.name).toBe('Makanan');
    expect(repoMock.update).toHaveBeenCalledWith('cat-sys', { name: 'Makanan' });
    expect(auditMock.record).toHaveBeenCalled();
  });

  it('update: allows editing the description of a system category', async () => {
    repoMock.findById.mockResolvedValue({ ...systemCategory });
    repoMock.update.mockResolvedValue({
      ...systemCategory,
      description: 'probe',
    });

    const updated = await service.update('u1', 'cat-sys', {
      description: 'probe',
    });

    expect(updated.description).toBe('probe');
    expect(repoMock.update).toHaveBeenCalledWith('cat-sys', {
      description: 'probe',
    });
  });

  it('softDelete: allows deleting a system (seed/default) category', async () => {
    repoMock.findById.mockResolvedValue({ ...systemCategory });
    repoMock.softDelete.mockResolvedValue(undefined);

    await expect(service.softDelete('u1', 'cat-sys')).resolves.toBeUndefined();

    expect(repoMock.softDelete).toHaveBeenCalledWith('cat-sys');
    expect(auditMock.record).toHaveBeenCalled();
  });

  it('update: still blocks renaming when the new name already exists (conflict)', async () => {
    repoMock.findById.mockResolvedValue({ ...systemCategory });
    repoMock.findByUserAndNameAndType.mockResolvedValue({
      ...systemCategory,
      id: 'cat-other',
      name: 'Transport',
    });

    await expect(
      service.update('u1', 'cat-sys', { name: 'Transport' }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repoMock.update).not.toHaveBeenCalled();
  });

  it('softDelete: still blocks access to another user category (not found for user)', async () => {
    repoMock.findById.mockResolvedValue({
      ...systemCategory,
      user_id: 'someone-else',
    });

    await expect(service.softDelete('u2', 'cat-sys')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repoMock.softDelete).not.toHaveBeenCalled();
  });
});
