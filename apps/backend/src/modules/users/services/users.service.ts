import { Injectable, Logger } from '@nestjs/common';
import { PrismaUsersRepository } from '../repositories/prisma-users.repository';
import { UserEntity } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { LoggerService } from '../../../common/logger/logger.service';
import { PasswordService } from '../../../common/security/password/password.service';
import { PrismaRoleRepository } from '../../auth/repositories/prisma-role.repository';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly repo: PrismaUsersRepository,
    private readonly loggerService: LoggerService,
    private readonly passwordService: PasswordService,
    private readonly roleRepo: PrismaRoleRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(create: CreateUserDto): Promise<UserEntity> {
    // Hash password before storing
    const hashed = await this.passwordService.hashPassword(create.password);

    let username = create.username;
    if (!username) {
      username = await this.generateUniqueUsername(create.email, create.full_name);
    }

    // map DTO -> entity
    const u: Partial<UserEntity> = {
      email: create.email,
      username,
      full_name: create.full_name,
      password_hash: hashed, // DO NOT LOG THIS VALUE
      avatar_url: create.avatar_url ?? null,
      phone_number: create.phone_number ?? null,
      status: 'PENDING_VERIFICATION',
    };

    // If this is the first user, assign SUPER_ADMIN role if present
    const userCount = await this.repo.count();
    if (userCount === 0) {
      const superRole = await this.roleRepo.ensureSuperAdmin();
      u.role_id = superRole.id;
      this.logger.log(
        `Role Assigned: SUPER_ADMIN to first user (deferred until creation)`,
      );
    } else if (!u.role_id) {
      const defaultRole = await this.roleRepo.ensureDefaultRole();
      u.role_id = defaultRole.id;
    }

    try {
      const created = await this.repo.create(u);
      this.loggerService.log('User Created', 'UsersService', {
        userId: created.id,
        email: created.email,
      });

      if (userCount === 0) {
        this.logger.log(`Role Assigned user=${created.id} role=SUPER_ADMIN`);
      }

      return created;
    } catch (err) {
      // Map Prisma unique constraint error to a friendly conflict error
      // Prisma error code for unique constraint is P2002
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: string }).code)
          : undefined;
      if (code === 'P2002') {
        throw ErrorService.create(
          ErrorCode.CONFLICT,
          'Email or username already exists',
        );
      }
      // Unknown error -> internal
      throw ErrorService.create(ErrorCode.INTERNAL);
    }
  }

  private async generateUniqueUsername(
    email: string,
    fullName?: string,
  ): Promise<string> {
    const normalized = (fullName || email.split('@')[0])
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24);
    const root = normalized || 'user';
    let candidate = root;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
      });

      if (!existing) return candidate;

      candidate = `${root}${suffix}`;
      suffix += 1;
    }
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findById(id);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findByEmail(email);
  }

  async listAll(): Promise<UserEntity[]> {
    return this.repo.findAll();
  }

  async update(id: string, input: UpdateUserDto): Promise<UserEntity> {
    const updates: Partial<UserEntity> = {
      full_name: input.full_name,
      avatar_url: input.avatar_url,
      phone_number: input.phone_number,
    };
    const updated = await this.repo.update(id, updates);
    this.loggerService.log('User Updated', 'UsersService', {
      userId: updated.id,
    });
    return updated;
  }

  async applyPasswordReset(
    id: string,
    hashedPassword: string,
  ): Promise<UserEntity> {
    // Set the new password hash and clear the reset token state (single-use).
    const updated = await this.repo.update(id, {
      password_hash: hashedPassword,
      password_reset_token_hash: null,
      password_reset_expires_at: null,
      password_reset_requested_at: null,
    });
    this.loggerService.log('Password Reset Applied', 'UsersService', {
      userId: id,
    });
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
    this.loggerService.log('User Deleted', 'UsersService', { userId: id });
  }

  async deleteOwnAccount(
    userId: string,
    currentEmail: string,
    body: { email: string; password: string },
  ): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'User not found');
    }

    if (body.email.trim().toLowerCase() !== currentEmail.trim().toLowerCase()) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Email confirmation does not match your account',
      );
    }

    const passwordMatches = await this.passwordService.verifyPassword(
      user.password_hash,
      body.password,
    );
    if (!passwordMatches) {
      throw ErrorService.create(
        ErrorCode.INVALID_CREDENTIALS,
        'Current password is incorrect',
      );
    }

    await this.repo.hardDelete(userId);
    this.loggerService.log('User Permanently Deleted', 'UsersService', {
      userId,
    });
  }

  async hardDelete(id: string): Promise<void> {
    await this.repo.hardDelete(id);
    this.loggerService.log('User Permanently Deleted', 'UsersService', {
      userId: id,
    });
  }
}
