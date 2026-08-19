import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Acceptance E2E for multi-currency isolation (fixed variant)
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

test.describe('Multi-currency acceptance (fixed)', () => {
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

    // Try to login as registered test user if available
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

  test('Transactions page: switching currency updates request and list counts', async ({ page }) => {
    // Authenticate the page using real tokens if available, otherwise use the legacy localStorage shortcut
    await page.goto(BASE + '/');
    if (e2eToken && e2eUser) {
      await page.evaluate((toks, user) => {
        try {
          localStorage.setItem('cashflow.accessToken', toks);
          localStorage.setItem('cashflow.refreshToken', 'e2e-dummy-refresh');
          localStorage.setItem('cashflow.user', JSON.stringify(user));
        } catch (e) {}
      }, e2eToken, e2eUser);
    } else {
      await page.evaluate(() => {
        try {
          localStorage.setItem('cashflow.accessToken', 'e2e-dummy-token');
          localStorage.setItem('cashflow.refreshToken', 'e2e-dummy-refresh');
          localStorage.setItem('cashflow.user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001' }));
        } catch (e) {}
      });
    }

    // Helper: change dashboard currency by writing to localStorage and reloading the page so the store hydrates
    async function setCurrency(code: string) {
      await page.evaluate((c) => {
        localStorage.setItem('cashflow-dashboard-currency', c);
      }, code);
      await page.reload({ waitUntil: 'networkidle' });
    }

    // visit transactions page
    await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });

    // Iterate currencies and assert
    for (const cur of ['IDR', 'USD', 'SGD', 'EUR']) {
      await setCurrency(cur);

      // Wait for any GET /transactions response, then assert it had the expected currency query param
      const transactionsResp = await page.waitForResponse((res) => {
        try {
          const url = res.url();
          return url.includes('/api/v1/transactions') && res.request().method() === 'GET';
        } catch (e) {
          return false;
        }
      }, { timeout: 15000 });

      // Inspect the request URL to see if currency param was included
      const transactionsUrl = new URL(transactionsResp.url());
      const sentCurrency = transactionsUrl.searchParams.get('currency');
      expect(sentCurrency).toBe(cur);

      expect(transactionsResp.ok()).toBeTruthy();
      const body = await transactionsResp.json();

      // Validate pagination.totalItems or fallback to data.length
      const totalItems = body?.pagination?.totalItems ?? (Array.isArray(body?.data) ? body.data.length : null);
      expect(totalItems).not.toBeNull();
      expect(totalItems).toBe(EXPECTED[cur as keyof typeof EXPECTED]);

      // Assert all returned transactions have account.currency === cur
      if (Array.isArray(body.data)) {
        for (const t of body.data) {
          if (t.account && t.account.currency) {
            expect(t.account.currency).toBe(cur);
          } else if (t.account_currency) {
            expect(t.account_currency).toBe(cur);
          }
        }
      }

      // UI count assertion via data-transaction-id
      const rows = await page.locator('[data-transaction-id]').count();
      if (rows > 0 && Array.isArray(body.data)) {
        const ids = body.data.map((d: any) => d.id);
        for (let i = 0; i < rows; i++) {
          const el = page.locator('[data-transaction-id]').nth(i);
          const id = await el.getAttribute('data-transaction-id');
          if (id) expect(ids).toContain(id);
        }
      }
    }
  });

  test('API-level reports/summary/analytics respect currency param', async ({ request }) => {
    for (const cur of ['IDR', 'USD', 'SGD', 'EUR']) {
      try {
        const txFetchOpts: any = {};
        if (e2eToken) txFetchOpts.headers = { Authorization: `Bearer ${e2eToken}` };
        const txRes = await request.get(API_BASE + `/transactions?currency=${cur}`, txFetchOpts);
        expect(txRes.ok()).toBeTruthy();
        const txBody = await txRes.json();
        const totalItems = txBody?.pagination?.totalItems ?? (Array.isArray(txBody?.data) ? txBody.data.length : null);
        expect(totalItems).toBe(EXPECTED[cur as keyof typeof EXPECTED]);

        const summaryFetchOpts: any = {};
        if (e2eToken) summaryFetchOpts.headers = { Authorization: `Bearer ${e2eToken}` };
        const summaryRes = await request.get(API_BASE + `/reports/summary?currency=${cur}`, summaryFetchOpts);
        if (summaryRes.status() === 404) continue;
        expect(summaryRes.ok()).toBeTruthy();
        const summBody = await summaryRes.json();
        if (summBody?.data?.total_income != null) expect(typeof summBody.data.total_income).toBe('number');
        if (summBody?.data?.total_expense != null) expect(typeof summBody.data.total_expense).toBe('number');

        const analyticsFetchOpts: any = {};
        if (e2eToken) analyticsFetchOpts.headers = { Authorization: `Bearer ${e2eToken}` };
        const analyticsRes = await request.get(API_BASE + `/analytics/overview?currency=${cur}`, analyticsFetchOpts);
        if (analyticsRes.status() === 404) continue;
        expect(analyticsRes.ok()).toBeTruthy();
        const analyticsBody = await analyticsRes.json();
        if (analyticsBody?.data?.income != null) expect(typeof analyticsBody.data.income).toBe('number');
      } catch (e) {
        console.error('API-level assertion failed for currency', cur, e);
        throw e;
      }
    }
  });
});
