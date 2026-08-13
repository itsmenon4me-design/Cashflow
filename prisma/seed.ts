import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import argon2 from 'argon2';
import { PrismaClient } from '../apps/backend/src/generated/prisma/client';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/cashflow?schema=public';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Ensure a role exists for the admin user.
    let role = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          code: 'SUPER_ADMIN',
          name: 'Super Admin',
          description: 'System super administrator',
          is_system: true,
        },
      });
    }

    const email = 'admin@cashflow.local';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const passwordHash = await argon2.hash('admin123', {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
      await prisma.user.create({
        data: {
          email,
          username: 'admin',
          full_name: 'Admin CashFlow',
          password_hash: passwordHash,
          status: 'ACTIVE',
          role_id: role.id,
        },
      });
      console.log('Seeded admin user: admin@cashflow.local / admin123');
    } else {
      console.log('Admin user already exists; skipping seed.');
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});