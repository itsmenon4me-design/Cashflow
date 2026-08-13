const fs = require('fs');
const path = require('path');
(async () => {
  // Safe, read-only DB evidence extractor for recovery Phase E.5.2
  // IMPORTANT: This script performs only SELECT/read operations using Prisma.
  // Primary candidate (hard-coded as per task):
  const RECORD_ID = '97b76766-d13a-4db6-8baf-572292b83913';
  const ACCOUNT_ID = 'e673f9a8-2e2a-4e58-af4f-1728be9bdfa1';
  const WINDOW_START = new Date('2026-08-11T13:38:31.606Z');
  const WINDOW_END = new Date('2026-08-11T14:38:31.606Z');

  // load generated prisma client
  const { PrismaClient } = require('./src/generated/prisma/client');
  const prisma = new PrismaClient();

  try {
    // 1) primary account (select only necessary, no secrets)
    const account = await prisma.account.findUnique({
      where: { id: ACCOUNT_ID },
      select: {
        id: true,
        name: true,
        currency: true,
        opening_balance_cents: true,
        current_balance_cents: true,
        created_at: true,
        updated_at: true
      }
    });

    // 2) primary transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: RECORD_ID },
      select: {
        id: true,
        account_id: true,
        transaction_type: true,
        amount_cents: true,
        category_id: true,
        description: true,
        created_at: true,
        updated_at: true
      }
    });

    // 3) neighboring transactions within the ±30 minute window
    const neighbors = await prisma.transaction.findMany({
      where: {
        account_id: ACCOUNT_ID,
        created_at: { gte: WINDOW_START, lte: WINDOW_END }
      },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        transaction_type: true,
        amount_cents: true,
        category_id: true,
        description: true,
        created_at: true,
        updated_at: true
      }
    });

    // 4) (optional) all transactions for the same account (limit to avoid huge dumps)
    const allAccountTx = await prisma.transaction.findMany({
      where: { account_id: ACCOUNT_ID },
      orderBy: { created_at: 'asc' },
      take: 1000,
      select: {
        id: true,
        transaction_type: true,
        amount_cents: true,
        created_at: true
      }
    });

    // BigInt-safe replacer
    function replacer(k, v) {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Date) return v.toISOString();
      return v;
    }

    const out = {
      generated_at: new Date().toISOString(),
      primary_account: account,
      primary_transaction: transaction,
      neighbors: neighbors,
      all_account_transactions_sample: allAccountTx
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = path.resolve(__dirname, 'recovery_reports', 'evidence');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `db_context_${timestamp}.json`);

    fs.writeFileSync(outPath, JSON.stringify(out, replacer, 2), 'utf-8');
    console.log(`WROTE ${outPath}`);
  } catch (err) {
    console.error('ERROR', err);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
