import { Module } from '@nestjs/common';
import { CategoriesController } from './controllers/categories.controller';
import { CategoriesService } from './services/categories.service';
import { PrismaCategoriesRepository } from './repositories/prisma-categories.repository';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, PrismaCategoriesRepository],
  exports: [CategoriesService],
})
export class CategoriesModule {}

