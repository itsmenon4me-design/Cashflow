import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export type Classification =
  | 'SAFE'
  | 'SUSPICIOUS'
  | 'LIKELY_CORRUPTED'
  | 'CONFIRMED_CORRUPTED'
  | 'REVIEW_REQUIRED';

export interface Candidate {
  id: string;
  account_id: string;
  currency: string;
  transaction_type?: string | null;
  stored_value: bigint;
  created_at: string | null;
  updated_at: string | null;
  classification: Classification;
  proposed_value?: bigint;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  reason?: string;
  evidence?: string[];
}

// Create PrismaClient with PrismaPg adapter using pg Pool for direct DB connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Conservative classifier for historical transaction records.
 *
 * Rules (summary):
 * - If currency !== 'IDR' => SAFE (we don't apply IDR recovery rules)
 * - If currency === 'IDR' and amount % 100 !== 0 -> SAFE (cannot be a simple ×100 of an integer)
 * - If currency === 'IDR' and amount % 100 === 0 -> check contextual evidence:
 *    * if there exists another transaction in same account with amount == amount/100 and created_at within 2 minutes => LIKELY_CORRUPTED (HIGH)
 *    * if account.opening_balance_cents == amount/100 => LIKELY_CORRUPTED (MEDIUM)
 *    * else => SUSPICIOUS (LOW)
 *
 * This implementation is intentionally conservative and errs on the side of requiring human review.
 */
export function classifyRecord(
  stored: bigint,
  currency: string,
  peers: Array<{ id: string; amount: bigint; created_at: Date | null }>,
  accountOpening: bigint | null,
  created_at: Date | null,
  transaction_id: string,
): {
  classification: Classification;
  proposed?: bigint;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  evidence: string[];
} {
  const evidence: string[] = [];
  if (currency !== 'IDR') {
    evidence.push('Non-IDR currency — no IDR recovery rule applied');
    return { classification: 'SAFE', confidence: 'HIGH', evidence };
  }

  if (stored % 100n !== 0n) {
    evidence.push(
      'Amount not divisible by 100 — cannot be simple ×100 IDR bug',
    );
    return { classification: 'SAFE', confidence: 'HIGH', evidence };
  }

  const candidate = stored / 100n;

  // look for peers with the smaller amount nearby in time
  for (const p of peers) {
    if (p.id === transaction_id) continue;
    if (p.amount === candidate) {
      const t1 = created_at ? new Date(created_at).getTime() : null;
      const t2 = p.created_at ? new Date(p.created_at).getTime() : null;
      if (t1 !== null && t2 !== null && Math.abs(t1 - t2) <= 2 * 60 * 1000) {
        evidence.push(
          `Found peer transaction ${p.id} with amount == stored/100 within 2 minutes`,
        );
        return {
          classification: 'LIKELY_CORRUPTED',
          proposed: candidate,
          confidence: 'HIGH',
          evidence,
        };
      }
    }
  }

  if (accountOpening !== null && accountOpening === candidate) {
    evidence.push('account opening balance equals stored/100');
    return {
      classification: 'LIKELY_CORRUPTED',
      proposed: candidate,
      confidence: 'MEDIUM',
      evidence,
    };
  }

  evidence.push(
    'Divisible by 100 but no immediate contextual match — manual review recommended',
  );
  return { classification: 'SUSPICIOUS', confidence: 'LOW', evidence };
}

export async function classifyTransactions(): Promise<Candidate[]> {
  // gather accounts map: accountId -> { currency, opening_balance_cents, current_balance_cents }
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      currency: true,
      opening_balance_cents: true,
      current_balance_cents: true,
    },
  });
  const accountMap = new Map<
    string,
    { currency: string; opening: bigint; current: bigint }
  >();
  for (const a of accounts) {
    accountMap.set(a.id, {
      currency: a.currency,
      opening: BigInt(a.opening_balance_cents ?? 0),
      current: BigInt(a.current_balance_cents ?? 0),
    });
  }

  // fetch transactions (ordered)
  const txs = await prisma.transaction.findMany({
    orderBy: { created_at: 'asc' },
  });

  // Build index by account and amount for quick lookup
  const byAccount = new Map<
    string,
    Array<{ id: string; amount: bigint; created_at: Date | null }>
  >();
  for (const t of txs) {
    const arr = byAccount.get(t.account_id) ?? [];
    arr.push({
      id: t.id,
      amount: BigInt(t.amount_cents),
      created_at: t.created_at ?? null,
    });
    byAccount.set(t.account_id, arr);
  }

  const candidates: Candidate[] = [];

  for (const t of txs) {
    const account = accountMap.get(t.account_id);
    const stored = BigInt(t.amount_cents);
    const currency = account?.currency ?? 'IDR';

    const result = classifyRecord(
      stored,
      currency,
      byAccount.get(t.account_id) ?? [],
      account ? account.opening : null,
      t.created_at ?? null,
      t.id,
    );

    candidates.push({
      id: t.id,
      account_id: t.account_id,
      currency,
      transaction_type: t.transaction_type,
      stored_value: stored,
      created_at: t.created_at ? t.created_at.toISOString() : null,
      updated_at: t.updated_at ? t.updated_at.toISOString() : null,
      classification: result.classification,
      proposed_value: result.proposed,
      confidence: result.confidence,
      reason:
        result.classification === 'SAFE' ? 'No correction needed' : undefined,
      evidence: result.evidence,
    });
  }

  await prisma.$disconnect();
  return candidates;
}
