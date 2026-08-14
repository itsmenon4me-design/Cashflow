#!/usr/bin/env node

import { classifyTransactions, Candidate } from './classifier';
import { serializeBigInt } from './serializer';
import fs from 'fs';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const outDir = path.resolve(__dirname, '../../../../recovery_reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log(`Running historical recovery scanner (dryRun=${dryRun})`);
  const candidates: Candidate[] = await classifyTransactions();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `dry_run_report_${timestamp}.json`);

  const summary = {
    scanned: candidates.length,
    counts: {
      SAFE: candidates.filter((c) => c.classification === 'SAFE').length,
      SUSPICIOUS: candidates.filter((c) => c.classification === 'SUSPICIOUS')
        .length,
      LIKELY_CORRUPTED: candidates.filter(
        (c) => c.classification === 'LIKELY_CORRUPTED',
      ).length,
      CONFIRMED_CORRUPTED: candidates.filter(
        (c) => c.classification === 'CONFIRMED_CORRUPTED',
      ).length,
      REVIEW_REQUIRED: candidates.filter(
        (c) => c.classification === 'REVIEW_REQUIRED',
      ).length,
    },
    generated_at: new Date().toISOString(),
  };

  const report = { summary, candidates };

  // Serialize BigInt values to JSON-safe strings before writing report
  const safeReport = serializeBigInt(report);

  fs.writeFileSync(outFile, JSON.stringify(safeReport, null, 2), 'utf-8');
  console.log(`Dry-run report written to ${outFile}`);
  console.log('NO DATABASE MUTATION PERFORMED.');
}

main().catch((err) => {
  console.error('Scanner failed:', err);
  process.exitCode = 1;
});
