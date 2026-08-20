import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import argon2 from 'argon2';
import { PrismaClient } from '../apps/backend/src/generated/prisma/client';

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55432/cashflow?schema=public';
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const email = 'admin@cashflow.local';
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('Admin user not found');
      process.exit(1);
    }
    const newHash = await argon2.hash('admin123', {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    await prisma.user.update({ where: { id: user.id }, data: { password_hash: newHash } });
    console.log('Admin password updated to admin123');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});