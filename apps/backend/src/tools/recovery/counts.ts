import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    const txCount = await prisma.transaction.count();
    const accCount = await prisma.account.count();
    const txMax = await prisma.transaction.findFirst({
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true },
    });
    const accMax = await prisma.account.findFirst({
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true },
    });
    const out = {
      transaction_count: txCount,
      account_count: accCount,
      latest_transaction_updated_at: txMax?.updated_at ?? null,
      latest_account_updated_at: accMax?.updated_at ?? null,
    };
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Counts script failed', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
