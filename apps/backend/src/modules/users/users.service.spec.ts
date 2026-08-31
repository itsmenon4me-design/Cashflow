import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './services/users.service';
import { PrismaUsersRepository } from './repositories/prisma-users.repository';
import { LoggerService } from '../../common/logger/logger.service';
import { PasswordService } from '../../common/security/password/password.service';
import { PrismaRoleRepository } from '../auth/repositories/prisma-role.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../database/prisma.service';

describe('UsersService (create)', () => {
  let service: UsersService;
  const mockRepo: { count: jest.Mock; create: jest.Mock } = {
    count: jest.fn(),
    create: jest.fn(),
  };
  const mockLoggerService = { log: jest.fn() };
  const mockPasswordService = { hashPassword: jest.fn() };
  const mockRoleRepo = {
    ensureSuperAdmin: jest.fn(),
    ensureDefaultRole: jest.fn(),
  };
  const mockPrisma = {
    user: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    mockRepo.count.mockReset();
    mockRepo.create.mockReset();
    mockPasswordService.hashPassword.mockReset();
    mockPrisma.user.findUnique.mockReset();
    mockRoleRepo.ensureSuperAdmin.mockReset();
    mockRoleRepo.ensureDefaultRole.mockReset();
    mockRoleRepo.ensureDefaultRole.mockResolvedValue({ id: 'default-role-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaUsersRepository, useValue: mockRepo },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: PrismaRoleRepository, useValue: mockRoleRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('hashes password and creates user', async () => {
    const dto: CreateUserDto = {
      email: 'new@example.com',
      full_name: 'New User',
      password: 'Secur3P@ssw0rd!',
    };

    mockPasswordService.hashPassword.mockResolvedValue('hashed-val');
    mockRepo.count.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const created = {
      id: 'u1',
      email: dto.email,
      username: 'newuser',
      full_name: dto.full_name,
      password_hash: 'hashed-val',
      created_at: new Date(),
      updated_at: new Date(),
      status: 'PENDING_VERIFICATION',
    };
    mockRepo.create.mockResolvedValue(created);

    const res = await service.create(dto);

    expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(dto.password);
expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: dto.email,
        username: 'newuser',
        full_name: dto.full_name,
        password_hash: 'hashed-val',
      }),
    );

    expect(res).toEqual(created);
  });

  it('maps unique constraint to conflict error', async () => {
    const dto: CreateUserDto = {
      email: 'dup@example.com',
      full_name: 'Dup User',
      password: 'Secur3P@ssw0rd!',
    };

    mockPasswordService.hashPassword.mockResolvedValue('hashed-val');
    mockRepo.count.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockRepo.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.create(dto)).rejects.toMatchObject({
      errorCode: ErrorCode.CONFLICT,
    });
  });
});
