import { getCurrencySpec, CURRENCY_SPECS } from '../../common/types/money';

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AuditStatus =
  'SAFE' | 'SUSPICIOUS' | 'LIKELY_CORRUPTED' | 'INCONSISTENT' | 'UNRESOLVED';

export interface HistoricalTransactionRecord {
  id: string;
  user_id?: string;
  account_id?: string;
  currency?: string;
  amount_cents?: bigint | number | string | null;
  transaction_type?: string;
  transaction_date?: Date | string | null;
  deleted_at?: Date | string | null;
  transfer_group_id?: string | null;
  transfer_reference?: string | null;
  note?: string | null;
}

export interface HistoricalAccountRecord {
  id: string;
  user_id?: string;
  currency?: string;
  current_balance_cents?: bigint | number | string | null;
  opening_balance_cents?: bigint | number | string | null;
  is_default?: boolean;
  deleted_at?: Date | string | null;
}

export interface HistoricalTransferRecord {
  id: string;
  user_id?: string;
  source_account_id?: string;
  destination_account_id?: string;
  amount_cents?: bigint | number | string | null;
  source_currency?: string;
  destination_currency?: string;
  transfer_group_id?: string | null;
  deleted_at?: Date | string | null;
}

export interface HistoricalBalanceDiscrepancy {
  account_id: string;
  user_id?: string;
  currency: string;
  stored_balance: string;
  reconstructed_balance: string;
  difference: string;
  severity: Severity;
}

export interface AuditFinding {
  finding_id: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  currency: string;
  stored_value: string;
  suspected_value?: string;
  severity: Severity;
  status: AuditStatus;
  confidence: number;
  reason: string;
  evidence: string[];
  recommended_action: string;
}

export interface ProposedRecoveryAction {
  finding_id: string;
  current_value: string;
  proposed_value?: string;
  reason: string;
  evidence: string[];
  confidence: number;
  reversible: boolean;
  requires_manual_approval: boolean;
}

export interface HistoricalAuditReport {
  audit_run_id: string;
  timestamp: string;
  application_version: string;
  currency_rules: Record<string, number>;
  records_scanned: number;
  transactions_scanned: number;
  accounts_scanned: number;
  transfers_scanned: number;
  findings_count: number;
  severity_summary: Record<Severity, number>;
  affected_accounts: string[];
  affected_currencies: string[];
  affected_date_ranges: string[];
  findings: AuditFinding[];
  balance_discrepancies: HistoricalBalanceDiscrepancy[];
  proposed_recovery_actions: ProposedRecoveryAction[];
}

export class HistoricalDataAuditService {
  static readonly FORBIDDEN_WRITE_OPERATIONS = [
    'update',
    'updateMany',
    'delete',
    'deleteMany',
    '$executeRaw',
    '$executeRawUnsafe',
  ] as const;

  private readonly supportedCurrencies = Object.keys(CURRENCY_SPECS);

  private normalizeBigInt(
    value: bigint | number | string | null | undefined,
  ): bigint {
    if (value === null || value === undefined) return 0n;
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 0n;
      return BigInt(Math.trunc(value));
    }
    const trimmed = String(value).trim();
    if (!trimmed) return 0n;
    return BigInt(trimmed);
  }

  private toStringAmount(
    value: bigint | number | string | null | undefined,
  ): string {
    return this.normalizeBigInt(value).toString();
  }

  private getCurrencyOrDefault(currency?: string): string {
    return currency && currency.trim() ? currency.trim().toUpperCase() : 'IDR';
  }

  private summarizeSeverity(
    findings: AuditFinding[],
  ): Record<Severity, number> {
    const summary: Record<Severity, number> = {
      INFO: 0,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const f of findings) {
      summary[f.severity] += 1;
    }
    return summary;
  }

  private hasUnsupportedCurrency(currency: string): boolean {
    return !this.supportedCurrencies.includes(currency.toUpperCase());
  }

  private detectIdrPattern(
    tx: HistoricalTransactionRecord,
    sameAccountTxns: HistoricalTransactionRecord[],
  ): AuditFinding | null {
    const currency = this.getCurrencyOrDefault(tx.currency);
    if (currency !== 'IDR') return null;

    const value = this.normalizeBigInt(tx.amount_cents);
    const isHundredMultiple = value > 0n && value % 100n === 0n;
    if (!isHundredMultiple) return null;

    const suspected = value / 100n;
    const hasScaleEvidence = sameAccountTxns.some((item) => {
      const itemValue = this.normalizeBigInt(item.amount_cents);
      return itemValue > 0n && itemValue === suspected;
    });

    if (!hasScaleEvidence) return null;

    const nearbyCount = sameAccountTxns.filter((item) => {
      const itemValue = this.normalizeBigInt(item.amount_cents);
      return itemValue > 0n && itemValue < value && itemValue % 100n === 0n;
    }).length;

    if (nearbyCount === 0) return null;
    return {
      finding_id: `hist-audit-${tx.id}-idr`,
      entity_type: 'transaction',
      entity_id: tx.id,
      user_id: tx.user_id,
      currency,
      stored_value: value.toString(),
      suspected_value: suspected.toString(),
      severity: 'MEDIUM',
      status: 'SUSPICIOUS',
      confidence: 0.72,
      reason:
        'IDR value is a round multiple of 100 and is inconsistent with neighboring same-account values; this matches historical ×100/÷100-style corruption patterns only when supported by multi-signal evidence.',
      evidence: [
        'currency=IDR',
        'stored amount is divisible by 100',
        'same-account historical amounts suggest a nearby non-corrupted scale',
      ],
      recommended_action:
        'Manual review required. Do not auto-correct historical amounts without explicit approval.',
    };
  }

  private detectZeroDecimalCorruption(
    tx: HistoricalTransactionRecord,
    account: HistoricalAccountRecord | undefined,
  ): AuditFinding | null {
    const currency = this.getCurrencyOrDefault(
      tx.currency ?? account?.currency,
    );
    if (!['USD', 'SGD', 'EUR'].includes(currency)) return null;

    const value = this.normalizeBigInt(tx.amount_cents);
    const spec = getCurrencySpec(currency);
    const isMinorAligned = value % BigInt(10 ** spec.minorUnits) === 0n;
    if (isMinorAligned || value === 0n) return null;

    const isLikelyWholeUnit = value > 0n && value % 10n === 0n;
    if (!isLikelyWholeUnit) return null;

    return {
      finding_id: `hist-audit-${tx.id}-minor`,
      entity_type: 'transaction',
      entity_id: tx.id,
      user_id: tx.user_id,
      currency,
      stored_value: value.toString(),
      suspected_value: (value / 100n).toString(),
      severity: 'LOW',
      status: 'SUSPICIOUS',
      confidence: 0.54,
      reason:
        'Decimal-currency value is integer-aligned but may not match the expected minor-unit storage semantics for the given currency.',
      evidence: [
        `currency=${currency}`,
        `expected minorUnits=${spec.minorUnits}`,
        'stored value is integer-aligned but lacks strong corroborating evidence',
      ],
      recommended_action:
        'Review against original source or account ledger before any correction proposal.',
    };
  }

  private detectMixedCurrencyAggregation(
    transactions: HistoricalTransactionRecord[],
  ): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const buckets = new Map<string, HistoricalTransactionRecord[]>();

    for (const tx of transactions) {
      const bucketKey = `${tx.user_id ?? 'unknown'}|${tx.account_id ?? 'unknown'}|${new Date(
        typeof tx.transaction_date === 'string'
          ? tx.transaction_date
          : (tx.transaction_date ?? new Date().toISOString()),
      )
        .toISOString()
        .slice(0, 7)}`;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey)!.push(tx);
    }

    for (const [bucketKey, group] of buckets.entries()) {
      const currencies = new Set(
        group
          .map((tx) => this.getCurrencyOrDefault(tx.currency))
          .filter((currency) => Boolean(currency)),
      );
      if (currencies.size > 1) {
        const summary = Array.from(currencies)
          .map(
            (currency) =>
              `${currency}:${group
                .filter(
                  (tx) => this.getCurrencyOrDefault(tx.currency) === currency,
                )
                .reduce(
                  (sum, tx) => sum + this.normalizeBigInt(tx.amount_cents),
                  0n,
                )
                .toString()}`,
          )
          .join('; ');
        findings.push({
          finding_id: `hist-audit-mixed-${bucketKey}`,
          entity_type: 'account-aggregation',
          entity_id: bucketKey,
          user_id: group[0]?.user_id,
          currency: 'MULTI',
          stored_value: summary,
          severity: 'HIGH',
          status: 'INCONSISTENT',
          confidence: 0.94,
          reason:
            'Historical aggregate appears to combine multiple currencies in the same account/month bucket; the system must isolate per-currency totals.',
          evidence: [
            'multiple currencies in one monthly aggregation bucket',
            'aggregate summary includes more than one active currency',
          ],
          recommended_action:
            'Flag for manual reconciliation and isolate report/dashboard aggregations by currency before any recovery planning.',
        });
      }
    }
    return findings;
  }

  private detectTransferInconsistencies(
    transfers: HistoricalTransferRecord[],
  ): AuditFinding[] {
    const findings: AuditFinding[] = [];
    const byGroup = new Map<string, HistoricalTransferRecord[]>();

    for (const transfer of transfers) {
      const key = transfer.transfer_group_id ?? `${transfer.id}`;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(transfer);
    }

    for (const [groupKey, items] of byGroup.entries()) {
      if (items.length === 1) {
        findings.push({
          finding_id: `hist-audit-transfer-${groupKey}`,
          entity_type: 'transfer',
          entity_id: items[0].id,
          user_id: items[0].user_id,
          currency: this.getCurrencyOrDefault(
            items[0].source_currency ?? items[0].destination_currency,
          ),
          stored_value: this.toStringAmount(items[0].amount_cents),
          severity: 'MEDIUM',
          status: 'INCONSISTENT',
          confidence: 0.86,
          reason:
            'A transfer leg exists without a matching counterpart or transfer group pair.',
          evidence: [
            'transfer group has exactly one leg',
            'pairing could not be validated',
          ],
          recommended_action:
            'Manually reconcile transfer pair before any recovery or correction attempt.',
        });
      }

      const first = items[0];
      const sourceCurrency = this.getCurrencyOrDefault(first.source_currency);
      const destinationCurrency = this.getCurrencyOrDefault(
        first.destination_currency,
      );
      if (sourceCurrency !== destinationCurrency) {
        findings.push({
          finding_id: `hist-audit-xfer-currency-${groupKey}`,
          entity_type: 'transfer',
          entity_id: first.id,
          user_id: first.user_id,
          currency: `${sourceCurrency}/${destinationCurrency}`,
          stored_value: this.toStringAmount(first.amount_cents),
          severity: 'HIGH',
          status: 'INCONSISTENT',
          confidence: 0.92,
          reason:
            'Cross-currency historical transfer exists and must not be silently treated as a same-currency transfer.',
          evidence: [
            'source and destination currency differ',
            'cross-currency transfer records are not automatically recoverable',
          ],
          recommended_action:
            'Keep as manual review; no automatic FX conversion or mutation.',
        });
      }

      const amounts = items.map((item) =>
        this.normalizeBigInt(item.amount_cents),
      );
      const uniqueAmounts = new Set(amounts.map((amount) => amount.toString()));
      if (uniqueAmounts.size > 1) {
        findings.push({
          finding_id: `hist-audit-transfer-amount-${groupKey}`,
          entity_type: 'transfer',
          entity_id: first.id,
          user_id: first.user_id,
          currency: sourceCurrency,
          stored_value: Array.from(uniqueAmounts).join(', '),
          severity: 'HIGH',
          status: 'INCONSISTENT',
          confidence: 0.9,
          reason:
            'Transfer legs within the same group carry different amounts, so the group cannot be treated as internally consistent.',
          evidence: ['same transfer group has mismatched leg amounts'],
          recommended_action:
            'Manual review required; do not auto-balance or coerce amounts.',
        });
      }
    }

    return findings;
  }

  private reconstructBalance(
    account: HistoricalAccountRecord,
    transactions: HistoricalTransactionRecord[],
  ): HistoricalBalanceDiscrepancy | null {
    const accountId = account.id;
    const currency = this.getCurrencyOrDefault(account.currency);
    const opening = this.normalizeBigInt(account.opening_balance_cents ?? 0n);
    const stored = this.normalizeBigInt(account.current_balance_cents ?? 0n);

    let reconstructed = opening;
    for (const tx of transactions) {
      if (tx.account_id !== accountId) continue;
      if (
        this.getCurrencyOrDefault(tx.currency ?? account.currency) !== currency
      )
        continue;
      if (tx.deleted_at) continue;
      const amount = this.normalizeBigInt(tx.amount_cents ?? 0n);
      if (tx.transaction_type === 'INCOME') {
        reconstructed += amount;
      } else if (tx.transaction_type === 'EXPENSE') {
        reconstructed -= amount;
      }
    }

    const difference = reconstructed - stored;
    if (difference === 0n) return null;

    const absoluteDifference = difference < 0n ? -difference : difference;

    return {
      account_id: accountId,
      user_id: account.user_id,
      currency,
      stored_balance: stored.toString(),
      reconstructed_balance: reconstructed.toString(),
      difference: difference.toString(),
      severity: absoluteDifference > 1000000n ? 'HIGH' : 'MEDIUM',
    };
  }

  private createRecoveryPlan(
    findings: AuditFinding[],
  ): ProposedRecoveryAction[] {
    return findings
      .filter(
        (finding) =>
          finding.status === 'LIKELY_CORRUPTED' ||
          finding.status === 'INCONSISTENT',
      )
      .map((finding) => ({
        finding_id: finding.finding_id,
        current_value: finding.stored_value,
        proposed_value: finding.suspected_value,
        reason: finding.reason,
        evidence: finding.evidence,
        confidence: finding.confidence,
        reversible: true,
        requires_manual_approval: true,
      }));
  }

  public auditFinancialDataset(params: {
    transactions?: HistoricalTransactionRecord[];
    accounts?: HistoricalAccountRecord[];
    transfers?: HistoricalTransferRecord[];
    applicationVersion?: string;
  }): HistoricalAuditReport {
    const transactions = params.transactions ?? [];
    const accounts = params.accounts ?? [];
    const transfers = params.transfers ?? [];

    const findings: AuditFinding[] = [];
    const balanceDiscrepancies: HistoricalBalanceDiscrepancy[] = [];

    for (const account of accounts) {
      const currency = this.getCurrencyOrDefault(account.currency);
      if (this.hasUnsupportedCurrency(currency)) {
        findings.push({
          finding_id: `hist-audit-account-${account.id}-currency`,
          entity_type: 'account',
          entity_id: account.id,
          user_id: account.user_id,
          currency,
          stored_value: this.toStringAmount(account.current_balance_cents),
          severity: 'HIGH',
          status: 'UNRESOLVED',
          confidence: 1,
          reason:
            'Account currency is unsupported by the authoritative currency registry.',
          evidence: ['currency not found in CURRENCY_SPECS'],
          recommended_action:
            'Manual review required before any downstream use or reporting.',
        });
      }

      const txs = transactions.filter((tx) => tx.account_id === account.id);
      const discrepancy = this.reconstructBalance(account, txs);
      if (discrepancy) {
        balanceDiscrepancies.push(discrepancy);
        findings.push({
          finding_id: `hist-audit-balance-${account.id}`,
          entity_type: 'account',
          entity_id: account.id,
          user_id: account.user_id,
          currency,
          stored_value: discrepancy.stored_balance,
          suspected_value: discrepancy.reconstructed_balance,
          severity: discrepancy.severity,
          status: 'INCONSISTENT',
          confidence: 0.88,
          reason:
            'Stored balance differs from the reconstructed account balance based on historical transaction activity.',
          evidence: [
            `stored_balance=${discrepancy.stored_balance}`,
            `reconstructed_balance=${discrepancy.reconstructed_balance}`,
            `difference=${discrepancy.difference}`,
          ],
          recommended_action:
            'Flag for manual reconciliation; no automatic balancing in this audit phase.',
        });
      }
    }

    for (const tx of transactions) {
      const account = accounts.find((item) => item.id === tx.account_id);
      const currency = this.getCurrencyOrDefault(
        tx.currency ?? account?.currency,
      );
      if (this.hasUnsupportedCurrency(currency)) {
        findings.push({
          finding_id: `hist-audit-tx-${tx.id}-currency`,
          entity_type: 'transaction',
          entity_id: tx.id,
          user_id: tx.user_id,
          currency,
          stored_value: this.toStringAmount(tx.amount_cents),
          severity: 'HIGH',
          status: 'UNRESOLVED',
          confidence: 1,
          reason:
            'Transaction currency is unsupported by the authoritative registry and cannot be audited with confidence.',
          evidence: ['currency not declared in CURRENCY_SPECS'],
          recommended_action:
            'Manual review required; do not infer or convert currency automatically.',
        });
      }

      if (
        account &&
        account.currency &&
        this.getCurrencyOrDefault(account.currency) !== currency
      ) {
        findings.push({
          finding_id: `hist-audit-tx-${tx.id}-account-currency`,
          entity_type: 'transaction',
          entity_id: tx.id,
          user_id: tx.user_id,
          currency,
          stored_value: this.toStringAmount(tx.amount_cents),
          severity: 'HIGH',
          status: 'INCONSISTENT',
          confidence: 0.98,
          reason:
            'Transaction currency differs from the owning account currency. This is a cross-currency mismatch and should remain flagged.',
          evidence: [
            `transaction_currency=${currency}`,
            `account_currency=${this.getCurrencyOrDefault(account.currency)}`,
          ],
          recommended_action:
            'Flag for manual reconciliation; do not auto-convert or merge currencies.',
        });
      }

      const sameAccountTxns = transactions.filter(
        (item) => item.account_id === tx.account_id && item.id !== tx.id,
      );
      const idrFinding = this.detectIdrPattern(tx, sameAccountTxns);
      if (idrFinding) findings.push(idrFinding);

      const minorFinding = this.detectZeroDecimalCorruption(tx, account);
      if (minorFinding) findings.push(minorFinding);
    }

    findings.push(...this.detectMixedCurrencyAggregation(transactions));
    findings.push(...this.detectTransferInconsistencies(transfers));

    const affectedAccounts = Array.from(
      new Set(findings.map((f) => f.entity_id).filter(Boolean)),
    );
    const affectedCurrencies = Array.from(
      new Set(
        findings
          .map((f) => f.currency)
          .filter((currency) => currency && currency !== 'MULTI'),
      ),
    );
    const affectedDateRanges = Array.from(
      new Set(
        transactions
          .map((tx) => tx.transaction_date)
          .filter(Boolean)
          .map((value) => new Date(value as string).toISOString().slice(0, 10)),
      ),
    );

    const report: HistoricalAuditReport = {
      audit_run_id: `hist-audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      application_version: params.applicationVersion ?? 'unknown',
      currency_rules: {
        IDR: 0,
        USD: 2,
        SGD: 2,
        EUR: 2,
      },
      records_scanned: transactions.length + accounts.length + transfers.length,
      transactions_scanned: transactions.length,
      accounts_scanned: accounts.length,
      transfers_scanned: transfers.length,
      findings_count: findings.length,
      severity_summary: this.summarizeSeverity(findings),
      affected_accounts: affectedAccounts,
      affected_currencies: affectedCurrencies,
      affected_date_ranges: affectedDateRanges,
      findings,
      balance_discrepancies: balanceDiscrepancies,
      proposed_recovery_actions: this.createRecoveryPlan(findings),
    };

    return report;
  }
}
