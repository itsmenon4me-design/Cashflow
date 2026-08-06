/**
 * Prisma seed entrypoint (placeholder)
 * Prisma will call this script when seeding is configured.
 * No real seed data yet — this file provides the structure for future seeds.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // placeholder: add seed logic here when ready
  console.log('Seed script executed (no data)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
