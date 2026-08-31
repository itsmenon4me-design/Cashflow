import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { UsersMeController } from './controllers/users-me.controller';
import { UsersService } from './services/users.service';
import { PrismaUsersRepository } from './repositories/prisma-users.repository';
import { PrismaModule } from '../../database/prisma.module';
import { LoggerModule } from '../../common/logger/logger.module';
import { ConfigModule } from '../../config/config.module';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaRoleRepository } from '../auth/repositories/prisma-role.repository';

@Module({
  imports: [PrismaModule, LoggerModule, ConfigModule, SecurityModule],
  controllers: [UsersMeController, UsersController],
  providers: [UsersService, PrismaUsersRepository, PrismaRoleRepository],
  exports: [UsersService],
})
export class UsersModule {}
