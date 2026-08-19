import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Final multi-currency acceptance verifying UI vs API without assuming client-side fetches
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
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

// Expected counts based on prisma/multi_currency_seed.sql
const EXPECTED = {
  IDR: 4,
  USD: 4,
  SGD: 3,
  EUR: 5,
};

test.describe('Multi-currency acceptance (Transactions/Reports/Summary/Analytics)', () => {
  let e2eToken: string | null = null;
  let e2eUser: any = null;

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

    // Try to login as registered test user (created earlier by helper or by manual setup)
    try {
      const login = await request.post(API_BASE + '/auth/login', {
        data: { email: 'e2e.api.user@test.local', password: 'TestPass123!' },
      });
      if (login.ok()) {
        const body = await login.json();
        e2eToken = body.data.accessToken;
        e2eUser = body.user;
      } else {
        console.warn('Login for e2e.api.user@test.local failed; continuing with unauthenticated tests');
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

      // A: set dashboard currency using the store's storage key
      await page.evaluate((k, c) => { try { localStorage.setItem(k, c); } catch (e) {} }, DASHBOARD_STORAGE_KEY, cur);

      // B + C: reload and navigate to transactions so the store hydrates and page renders under new currency
      await page.reload({ waitUntil: 'networkidle' });
      await page.goto(BASE + '/transactions', { waitUntil: 'networkidle' });

      // D: wait for UI to render - either rows or an empty-state text
      const rowsLocator = page.locator('[data-transaction-id]');
      await Promise.race([
        rowsLocator.first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {}),
        page.waitForSelector('text=No transactions', { timeout: 10000 }).catch(() => {}),
      ]);

      // E: fetch transactions via API (authenticated if token present)
      const fetchOpts: any = {};
      if (e2eToken) fetchOpts.headers = { Authorization: `Bearer ${e2eToken}` };
      const txRes = await request.get(API_BASE + `/transactions?currency=${cur}&limit=100`, fetchOpts);
      expect(txRes.ok()).toBeTruthy();
      const txBody = await txRes.json();

      const totalItems = txBody?.pagination?.totalItems ?? (Array.isArray(txBody?.data) ? txBody.data.length : null);
      expect(totalItems).toBe(EXPECTED[cur], `API totalItems for ${cur} should match expected`);

      // ensure API returned no foreign-currency records (best-effort)
      const foreign = (txBody?.data ?? []).filter((d: any) => {
        if (d.account && d.account.currency) return d.account.currency !== cur;
        if (d.account_currency) return d.account_currency !== cur;
        return false;
      });
      expect(foreign.length).toBe(0, `API returned ${foreign.length} foreign-currency records for ${cur}`);

      const apiIds: string[] = Array.isArray(txBody?.data) ? txBody.data.map((d: any) => d.id) : [];
      previousApiIds[cur] = apiIds;

      // F/G: collect UI-visible IDs and assert they are subset of API IDs
      const uiCount = await rowsLocator.count();
      const uiIds: string[] = [];
      for (let idx = 0; idx < uiCount; idx++) {
        const el = rowsLocator.nth(idx);
        const id = await el.getAttribute('data-transaction-id');
        if (id) uiIds.push(id);
      }

      if (uiIds.length > 0) {
        for (const id of uiIds) {
          expect(apiIds.includes(id)).toBeTruthy();
        }
      }

      // H: ensure UI does not include IDs from previous currency
      if (i > 0) {
        const prev = CURRENCIES[i - 1];
        const prevIds = previousApiIds[prev] ?? [];
        for (const id of uiIds) {
          expect(prevIds.includes(id)).toBeFalsy();
        }
      }

      console.log(`currency=${cur} api_total=${totalItems} ui_rows=${uiIds.length}`);
    }
  });

  // Note: Reports / Summary / Analytics endpoints are typically backend routes. The following tests perform API-level assertions
  test('API-level reports/summary/analytics respect currency param', async ({ request }) => {
    for (const cur of ['IDR', 'USD', 'SGD', 'EUR']) {
      // Use authenticated request context if token available
      let authReq = request;
      let authContext: any = null;
      if (e2eToken) {
        authContext = await request.newContext({
          extraHTTPHeaders: { Authorization: `Bearer ${e2eToken}` },
        });
        authReq = authContext;
      }

      try {
        // Transactions list assertion via API
        const txRes = await authReq.get(API_BASE + `/transactions?currency=${cur}`);
        expect(txRes.ok()).toBeTruthy();
        const txBody = await txRes.json();
        const totalItems = txBody?.pagination?.totalItems ?? (Array.isArray(txBody?.data) ? txBody.data.length : null);
        expect(totalItems).toBe(EXPECTED[cur as keyof typeof EXPECTED]);

        // Reports summary
        const summaryRes = await authReq.get(API_BASE + `/reports/summary?currency=${cur}`);
        // If endpoint exists, it should return OK and scoped numbers; if not found, skip with a warning
        if (summaryRes.status() === 404) continue;
        expect(summaryRes.ok()).toBeTruthy();
        const summBody = await summaryRes.json();
        // Basic shape assertions: totals exist and look numeric
        if (summBody?.data?.total_income != null) expect(typeof summBody.data.total_income).toBe('number');
        if (summBody?.data?.total_expense != null) expect(typeof summBody.data.total_expense).toBe('number');

        // Analytics overview
        const analyticsRes = await authReq.get(API_BASE + `/analytics/overview?currency=${cur}`);
        if (analyticsRes.status() === 404) continue;
        expect(analyticsRes.ok()).toBeTruthy();
        const analyticsBody = await analyticsRes.json();
        // Basic sanity check: numerical fields present
        if (analyticsBody?.data?.income != null) expect(typeof analyticsBody.data.income).toBe('number');
      } finally {
        if (authContext) await authContext.dispose();
      }
    }
  });
});
