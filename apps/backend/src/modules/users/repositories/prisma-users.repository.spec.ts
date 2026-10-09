import { PrismaUsersRepository } from './prisma-users.repository';
import { DEFAULT_CATEGORIES } from '../../categories/default-categories';
import { PrismaService } from '../../../database/prisma.service';

describe('PrismaUsersRepository', () => {
  it('creates a new user and their editable system categories atomically', async () => {
    const createdAt = new Date();
    const userRecord = {
      id: 'user-1',
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null,
      email: 'new@example.com',
      username: 'newuser',
      full_name: 'New User',
      password_hash: 'hashed-password',
      has_manual_password: true,
      avatar_url: null,
      phone_number: null,
      status: 'PENDING_VERIFICATION',
      email_verified_at: null,
      last_login_at: null,
      verification_token_hash: null,
      verification_token_expires_at: null,
      password_reset_token_hash: null,
      password_reset_expires_at: null,
      password_reset_requested_at: null,
      role_id: 'role-1',
      role: { code: 'USER' },
    };
    const prisma = {
      user: {
        create: jest.fn().mockResolvedValue(userRecord),
      },
    };
    const repository = new PrismaUsersRepository(
      prisma as unknown as PrismaService,
    );

    await repository.create({
      email: userRecord.email,
      username: userRecord.username,
      full_name: userRecord.full_name,
      password_hash: userRecord.password_hash,
      status: userRecord.status,
      role_id: userRecord.role_id,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: userRecord.email,
        username: userRecord.username,
        full_name: userRecord.full_name,
        password_hash: userRecord.password_hash,
        has_manual_password: null,
        status: userRecord.status,
        avatar_url: null,
        phone_number: null,
        role_id: userRecord.role_id,
        categories: {
          create: DEFAULT_CATEGORIES.map(({ name, type }) => ({
            name,
            type,
            is_system: true,
          })),
        },
      },
      include: { role: true },
    });
  });
});
