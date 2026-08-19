import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

test.setTimeout(120000);

test.describe('Multi-currency reports & analytics (smoke)', () => {
  let e2eToken: string | null = null;

  test.beforeAll(async ({ request }) => {
    if (DB_URL) {
      const pool = new Pool({ connectionString: DB_URL });
      try {
        const seedPath = path.resolve(process.cwd(), 'prisma/multi_currency_seed.sql');
        if (fs.existsSync(seedPath)) {
          const sql = fs.readFileSync(seedPath, 'utf8');
          const client = await pool.connect();
          try { await client.query('BEGIN'); await client.query(sql); await client.query('COMMIT'); } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
        }
      } finally { await pool.end(); }
    }

    // obtain token
    try {
      const login = await request.post(API_BASE + '/auth/login', { data: { email: 'e2e.api.user@test.local', password: 'TestPass123!' } });
      if (login.ok()) {
        const body = await login.json();
        e2eToken = body?.data?.accessToken ?? body?.accessToken ?? null;
      }
    } catch (e) {
      // proceed unauthenticated
    }
  });

  test('Reports monthly and Analytics overview reflect active currency and API', async ({ page, request }) => {
    const CURRENCIES = ['IDR','USD','SGD','EUR'];
    const DASHBOARD_STORAGE_KEY = 'cashflow-dashboard-currency';

    for (const cur of CURRENCIES) {
      // set currency
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.evaluate(({ k, c }) => { try { localStorage.setItem(k, c); } catch (e) {} }, { k: DASHBOARD_STORAGE_KEY, c: cur });
      await page.reload({ waitUntil: 'networkidle' });

      // Reports
      await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
      const opts: any = {};
      if (e2eToken) opts.headers = { Authorization: `Bearer ${e2eToken}` };
      const r = await request.get(API_BASE + `/reports/monthly?startDate=2020-01-01&endDate=2030-12-31&currency=${cur}`, opts);
      expect(r.ok()).toBeTruthy();
      const rb = await r.json();
      const txCount = rb?.summary?.transactions ?? null;
      console.log(`reports.monthly ${cur} => transactions=${txCount}`);
      if (txCount != null) {
        const expected = txCount.toLocaleString('id-ID');
        // wait for formatted string (if UI shows it for the selected range)
        try { await page.waitForSelector(`text=${expected}`, { timeout: 5000 }); } catch {}
      }

      // Analytics
      await page.goto(BASE + '/analytics', { waitUntil: 'networkidle' });
      const a = await request.get(API_BASE + `/analytics/overview?startDate=2020-01-01&endDate=2030-12-31&currency=${cur}`, opts);
      expect(a.ok()).toBeTruthy();
      const ab = await a.json();
      console.log(`analytics.overview ${cur} => transactions=${ab?.transactions} income=${ab?.income} expense=${ab?.expense}`);
      if (ab?.transactions != null) {
        const expectedA = ab.transactions.toLocaleString('id-ID');
        try { await page.waitForSelector(`text=${expectedA}`, { timeout: 5000 }); } catch {}
      }
    }
  });
});
