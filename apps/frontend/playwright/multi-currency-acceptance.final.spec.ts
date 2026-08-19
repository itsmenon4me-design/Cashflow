import { test, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Final multi-currency acceptance verifying UI vs API without assuming client-side fetches
// Increase default test timeout to allow page reloads and network activity on local verify stack
test.setTimeout(120000);
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3101/api/v1';
const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

if (!DB_URL) console.warn('No TEST_DATABASE_URL provided; DB seeding will be skipped.');

async function runSqlFile(pool: Pool, filePath: string) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

const EXPECTED: Record<string, number> = { IDR: 4, USD: 4, SGD: 3, EUR: 5 };

// Mirrors src/lib/money.ts CURRENCY_SPECS so expected UI strings match the app's
// Intl formatting exactly (same locale + fraction digits, no symbol-spacing hack —
// the reports/analytics pages format via plain Intl.NumberFormat).
const CURRENCY_SPECS: Record<string, { locale: string; digits: number }> = {
  IDR: { locale: 'id-ID', digits: 0 },
  USD: { locale: 'en-US', digits: 2 },
  SGD: { locale: 'en-SG', digits: 2 },
  EUR: { locale: 'de-DE', digits: 2 },
};

function fmtMoney(cents: number, cur: string): string {
  const spec = CURRENCY_SPECS[cur];
  return new Intl.NumberFormat(spec.locale, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: spec.digits,
    maximumFractionDigits: spec.digits,
  }).format(cents / Math.pow(10, spec.digits));
}

// Selector-independent of UI locale: the period SelectTrigger carries a stable id,
// SelectItems are Radix with data-slot="select-item" and their label matches
// "Kustom"/"Custom"; the custom date inputs have stable ids (#report-start/#report-end).
async function setCustomPeriod(page: Page, start: string, end: string) {
  const trigger = page.locator('#report-period-select');
  await expect(trigger, 'period select must become enabled').toBeEnabled({ timeout: 20000 });
  await trigger.click();
  const customOption = page.locator('[data-slot="select-item"]', { hasText: /kustom|custom/i });
  await customOption.waitFor({ state: 'visible', timeout: 5000 });
  await customOption.click();
  await page.locator('#report-start').fill(start, { timeout: 5000 });
  await page.locator('#report-end').fill(end, { timeout: 5000 });
}

// Strict UI evidence: the SummaryCard containing the given label must be visible and
// its value must equal the API-derived string exactly. No best-effort fallbacks.
async function expectSummaryCard(page: Page, label: string, expected: string, what: string) {
  const card = page.locator('.shadow-sm', { has: page.locator('p', { hasText: label }) }).first();
  await expect(card, `${what}: summary card '${label}' must be visible`).toBeVisible({ timeout: 20000 });
  await expect(card.locator('p.text-2xl'), `${what}: '${label}' must show '${expected}'`).toHaveText(expected, { timeout: 20000 });
}

test.describe('Multi-currency acceptance (final)', () => {
  let e2eToken: string | null = null;

  test.beforeAll(async ({ request }) => {
    if (!DB_URL) return;
    const pool = new Pool({ connectionString: DB_URL });
    try {
      const seedPath = path.resolve(process.cwd(), 'prisma/multi_currency_seed.sql');
      if (!fs.existsSync(seedPath)) throw new Error('Seed file not found: ' + seedPath);
      await runSqlFile(pool, seedPath);
    } finally {
      await pool.end();
    }

    // Obtain auth token for API checks if possible
    try {
      const login = await request.post(API_BASE + '/auth/login', {
        data: { email: 'e2e.api.user@test.local', password: 'TestPass123!' },
      });
      if (login.ok()) {
        const body = await login.json();
        e2eToken = body?.data?.accessToken ?? body?.accessToken ?? null;
        if (!e2eToken) console.warn('Login returned no access token; proceeding unauthenticated');
      } else {
        console.warn('Login failed with status', login.status());
      }
    } catch (e) {
      console.warn('Login attempt failed', e);
    }
  });

  test('Transactions UI matches API and does not show foreign-currency IDs after switch', async ({ page, request }) => {
    // Ensure page load and any existing auth
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    if (e2eToken) {
      await page.evaluate((t) => { try { localStorage.setItem('cashflow.accessToken', t); } catch (e) {} }, e2eToken);
    } else {
      // fallback user id used in some E2E setups
      await page.evaluate(() => { try { localStorage.setItem('cashflow.accessToken', 'e2e-dummy-token'); localStorage.setItem('cashflow.user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001' })); } catch (e) {} });
    }

    const CURRENCIES = ['IDR', 'USD', 'SGD', 'EUR'];
    const DASHBOARD_STORAGE_KEY = 'cashflow-dashboard-currency';
    const previousApiIds: Record<string, string[]> = {};

    for (let i = 0; i < CURRENCIES.length; i++) {
      const cur = CURRENCIES[i];

// A: open a fresh page so we do not rely on the original page remaining alive.
      // Set the dashboard currency on the MAIN page (it has a real origin): a brand-new
      // page is about:blank, where localStorage access throws SecurityError — a write
      // there would be silently swallowed by the try/catch and the store would hydrate
      // with the default currency (USD) instead. Child pages share the context's
      // localStorage, so they inherit the value before their JS bundle initializes.
      await page.evaluate(({ k, c }) => { try { localStorage.setItem(k, c); } catch (e) {} }, { k: DASHBOARD_STORAGE_KEY, c: cur });
      const child = await page.context().newPage();
      try {
        // navigate to transactions on the child page so the store hydrates and page renders under new currency
        await child.goto(BASE + '/transactions', { waitUntil: 'networkidle' });

        // D: set filter date range to cover seeded transactions (REQUIRED: the page defaults
        // to the current month, while seed data lives in Jan-Apr 2026, so the UI would
        // otherwise render zero rows and the UI-vs-API comparison would be vacuous).
        // The app defaults to the Indonesian locale, so date inputs render as
        // "Tanggal Awal"/"Tanggal Akhir"; match both locales.
        const startDateInput = child.locator('input[aria-label="Start Date"], input[aria-label="Tanggal Awal"]').first();
        const endDateInput = child.locator('input[aria-label="End Date"], input[aria-label="Tanggal Akhir"]').first();
        await startDateInput.fill('2026-01-01', { timeout: 15000 });
        await endDateInput.fill('2026-04-30', { timeout: 15000 });

        // F: the UI must actually render rows for the same range the API was checked against.
        // Scope to :visible — TransactionTable renders both desktop rows and (hidden at
        // this viewport) mobile cards carrying data-transaction-id; counting hidden
        // elements would double the count.
        const rowsLocator = child.locator('[data-transaction-id]:visible');

      // E: fetch transactions via API (use server-side API as truth)
      const txFetchResp = await fetch(API_BASE + `/transactions?currency=${cur}&limit=100`, e2eToken ? { headers: { Authorization: 'Bearer ' + e2eToken } } : undefined);
      expect(txFetchResp.ok).toBeTruthy();
      const txBody = await txFetchResp.json();

      const totalItems = txBody?.pagination?.totalItems ?? (Array.isArray(txBody?.data) ? txBody.data.length : null);
      expect(totalItems, `API totalItems for ${cur} should match expected`).toBe(EXPECTED[cur]);

      // ensure API returned no foreign-currency records
      const foreign = (txBody?.data ?? []).filter((d: any) => {
        if (d.account && d.account.currency) return d.account.currency !== cur;
        if (d.account_currency) return d.account_currency !== cur;
        return false;
      });
      expect(foreign.length, `API returned ${foreign.length} foreign-currency records for ${cur}`).toBe(0);

      const apiIds: string[] = Array.isArray(txBody?.data) ? txBody.data.map((d: any) => d.id) : [];
      previousApiIds[cur] = apiIds;

      // F: wait until the UI actually renders rows for the same range the API was checked against
      try {
        await rowsLocator.first().waitFor({ state: 'visible', timeout: 15000 });
      } catch {
        throw new Error(`UI rendered no transaction rows for ${cur}; API returned ${apiIds.length}. Date filter likely not applied.`);
      }

      const uiCount = await rowsLocator.count();
      expect(uiCount, `UI row count for ${cur} should match API count`).toBe(apiIds.length);

      // G: collect UI-visible IDs and assert they exactly match the current-currency API IDs
      const uiIds: string[] = [];
      for (let idx = 0; idx < uiCount; idx++) {
        const id = await rowsLocator.nth(idx).getAttribute('data-transaction-id');
        if (id) uiIds.push(id);
      }

      for (const id of uiIds) {
        expect(apiIds.includes(id)).toBeTruthy();
      }

      // H: ensure UI does not include IDs from previous currency
      if (i > 0) {
        const prev = CURRENCIES[i - 1];
        const prevIds = previousApiIds[prev] ?? [];
        for (const id of uiIds) {
          expect(prevIds.includes(id)).toBeFalsy();
        }
      }

console.log(`currency=${cur} api_total=${totalItems} ui_rows=${uiIds.length} ui_matches_api=${uiIds.length === apiIds.length}`);
      } finally {
        // close the child page to avoid leaking resources
        try { await child.close(); } catch (e) {}
      }
    }
  });

  test('Reports and Analytics UI reflect active currency and match API', async ({ page, request }) => {
    const CURRENCIES = ['IDR', 'USD', 'SGD', 'EUR'];
    const DASHBOARD_STORAGE_KEY = 'cashflow-dashboard-currency';
    const START = '2026-01-01';
    const END = '2026-04-30';
    // The UI's applyCustom() converts local-midnight values to ISO instants; mirror it
    // so the API evidence covers exactly the same window the UI renders.
    const START_ISO = new Date(START + 'T00:00:00').toISOString();
    const END_ISO = new Date(END + 'T23:59:59.999').toISOString();

    const apiGet = (path: string) => fetch(API_BASE + path, e2eToken ? { headers: { Authorization: 'Bearer ' + e2eToken } } : undefined);

    const setCurrency = async (cur: string) => {
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      if (e2eToken) {
        await page.evaluate((t) => { try { localStorage.setItem('cashflow.accessToken', t); } catch (e) {} }, e2eToken);
      }
      await page.evaluate(({ k, c }) => { try { localStorage.setItem(k, c); } catch (e) {} }, { k: DASHBOARD_STORAGE_KEY, c: cur });
      await page.reload({ waitUntil: 'networkidle' });
    };

    let reportsUiCalls = 0;
    page.on('request', (req) => { if (req.url().includes('/reports/monthly')) reportsUiCalls++; });

    // ---- Phase A: Analytics (page proven to render; strict UI-vs-API per currency) ----
    for (const cur of CURRENCIES) {
      await setCurrency(cur);

      const aResp = await apiGet(`/analytics/overview?startDate=${encodeURIComponent(START_ISO)}&endDate=${encodeURIComponent(END_ISO)}&currency=${cur}`);
      expect(aResp.ok, `analytics API ok for ${cur}`).toBe(true);
      const aBody = await aResp.json();
      const aTx: number = aBody?.transactions;
      expect(aTx, `analytics API transactions for ${cur} must not be null`).not.toBeNull();
      const expTx = aTx.toLocaleString('id-ID');
      const expIncome = fmtMoney(Number(aBody.income), cur);
      const expExpense = fmtMoney(Number(aBody.expense), cur);
      const expNet = fmtMoney(Number(aBody.netCashFlow), cur);
      const expRate = `${Number(aBody.savingRate).toFixed(1)}%`;

      await page.goto(BASE + '/analytics', { waitUntil: 'networkidle' });
      await setCustomPeriod(page, START, END);
      // strict request-level isolation evidence: after Apply, the UI must issue an
      // analytics/overview request scoped to the active currency
      const uiReq = page.waitForRequest((r) => r.url().includes('/analytics/overview') && r.url().includes('currency=' + cur), { timeout: 15000 });
      await page.getByRole('button', { name: /terapkan|apply/i }).click();
      await uiReq;

      await expectSummaryCard(page, 'Total Pemasukan', expIncome, `analytics income UI ${cur}`);
      await expectSummaryCard(page, 'Total Pengeluaran', expExpense, `analytics expense UI ${cur}`);
      await expectSummaryCard(page, 'Arus Kas Bersih', expNet, `analytics net UI ${cur}`);
      await expectSummaryCard(page, 'Saving Rate', expRate, `analytics saving-rate UI ${cur}`);
      await expectSummaryCard(page, 'Jumlah Transaksi', expTx, `analytics tx-count UI ${cur}`);
      console.log(`analytics_currency=${cur} api_tx=${aTx} ui_tx=${expTx} api_income=${expIncome} ui_income_matched=true`);
    }

    // ---- Phase B: Reports (strict; currently BLOCKED by a production bug in reports-page.tsx) ----
    for (const cur of CURRENCIES) {
      await setCurrency(cur);

      const rResp = await apiGet(`/reports/monthly?startDate=${encodeURIComponent(START_ISO)}&endDate=${encodeURIComponent(END_ISO)}&currency=${cur}`);
      expect(rResp.ok, `reports API ok for ${cur}`).toBe(true);
      const rBody = await rResp.json();
      const rTx: number = rBody?.summary?.transactions;
      expect(rTx, `reports API summary.transactions for ${cur} must not be null`).not.toBeNull();
      const expTx = rTx.toLocaleString('id-ID');
      const expIncome = fmtMoney(Number(rBody.summary.income), cur);
      const expExpense = fmtMoney(Number(rBody.summary.expense), cur);
      const expNet = fmtMoney(Number(rBody.summary.netCashFlow), cur);
      console.log(`reports_api_currency=${cur} api_tx=${rTx} ok=true`);

      reportsUiCalls = 0;
      await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
      const errShown = await page.getByText(/Terjadi kesalahan|Something went wrong/i).isVisible().catch(() => false);
      console.log(`reports_ui_currency=${cur} api_tx=${rTx} error_state=${errShown} ui_reports_monthly_calls=${reportsUiCalls}`);
      expect.soft(
        !errShown,
        `reports UI for ${cur} must render data. BLOCKED by production bug: reports-page.tsx calls useDashboardCurrencyStore(...) (a React hook) inside useEffect's async run() → Invalid hook call → caught → ErrorState; the UI issues zero /reports/monthly requests (calls=${reportsUiCalls}) while the API returns tx=${rTx} for ${cur}. TEST-ONLY fix is impossible without weakening evidence; the production fix (outside E2E scope) is to mirror analytics-page.tsx:105: useDashboardCurrencyStore.getState().currency.`
      ).toBe(true);

      if (!errShown) {
        await setCustomPeriod(page, START, END);
        const uiReq = page.waitForRequest((r) => r.url().includes('/reports/monthly') && r.url().includes('currency=' + cur), { timeout: 15000 });
        await page.getByRole('button', { name: /terapkan|apply/i }).click();
        await uiReq;
        await expectSummaryCard(page, 'Total Pemasukan', expIncome, `reports income UI ${cur}`);
        await expectSummaryCard(page, 'Total Pengeluaran', expExpense, `reports expense UI ${cur}`);
        await expectSummaryCard(page, 'Arus Kas Bersih', expNet, `reports net UI ${cur}`);
        await expectSummaryCard(page, 'Jumlah Transaksi', expTx, `reports tx-count UI ${cur}`);
        console.log(`reports_currency=${cur} api_tx=${rTx} ui_tx=${expTx} ui_matched=true`);
      }
    }
  });

});
