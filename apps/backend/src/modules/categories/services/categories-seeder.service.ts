import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CategoriesSeederService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesSeederService.name);
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      // Default system categories per user
      const income = ['Salary', 'Bonus', 'Investment', 'Gift', 'Other Income'];
      const expense = [
        'Food',
        'Transport',
        'Shopping',
        'Bills',
        'Health',
        'Education',
        'Entertainment',
        'Investment',
        'Other Expense',
      ];

      const users = await this.prisma.user.findMany();
      for (const u of users) {
        for (const name of income) {
          const exists = await this.prisma.category.findFirst({
            where: { user_id: u.id, name, type: 'INCOME' },
          });
          if (!exists) {
            await this.prisma.category.create({
              data: { user_id: u.id, name, type: 'INCOME', is_system: true },
            });
          }
        }
        for (const name of expense) {
          const exists = await this.prisma.category.findFirst({
            where: { user_id: u.id, name, type: 'EXPENSE' },
          });
          if (!exists) {
            await this.prisma.category.create({
              data: { user_id: u.id, name, type: 'EXPENSE', is_system: true },
            });
          }
        }
        // Ensure transfer specific categories
        const out = await this.prisma.category.findFirst({
          where: { user_id: u.id, name: 'Transfer Out', type: 'EXPENSE' },
        });
        if (!out)
          await this.prisma.category.create({
            data: {
              user_id: u.id,
              name: 'Transfer Out',
              type: 'EXPENSE',
              is_system: true,
            },
          });
        const inp = await this.prisma.category.findFirst({
          where: { user_id: u.id, name: 'Transfer In', type: 'INCOME' },
        });
        if (!inp)
          await this.prisma.category.create({
            data: {
              user_id: u.id,
              name: 'Transfer In',
              type: 'INCOME',
              is_system: true,
            },
          });
      }

      this.logger.log(`Seeded system categories for ${users.length} users`);
    } catch (err) {
      this.logger.warn(`Unable to seed categories: ${String(err)}`);
    }
  }
}
