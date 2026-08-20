# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: multi-currency-acceptance.sw-unregister.spec.ts >> Multi-currency reports & analytics (sw-unregister) >> Reports monthly and Analytics overview reflect active currency and API (sw-unregister)
- Location: playwright\multi-currency-acceptance.sw-unregister.spec.ts:40:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.goto: Test timeout of 120000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/analytics", waiting until "networkidle"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import * as fs from 'fs';
  3  | import * as path from 'path';
  4  | import { Pool } from 'pg';
  5  | 
  6  | const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
  7  | const API_BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
  8  | const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  9  | 
  10 | test.setTimeout(120000);
  11 | 
  12 | test.describe('Multi-currency reports & analytics (sw-unregister)', () => {
  13 |   let e2eToken: string | null = null;
  14 | 
  15 |   test.beforeAll(async ({ request }) => {
  16 |     if (DB_URL) {
  17 |       const pool = new Pool({ connectionString: DB_URL });
  18 |       try {
  19 |         const seedPath = path.resolve(process.cwd(), 'prisma/multi_currency_seed.sql');
  20 |         if (fs.existsSync(seedPath)) {
  21 |           const sql = fs.readFileSync(seedPath, 'utf8');
  22 |           const client = await pool.connect();
  23 |           try { await client.query('BEGIN'); await client.query(sql); await client.query('COMMIT'); } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  24 |         }
  25 |       } finally { await pool.end(); }
  26 |     }
  27 | 
  28 |     // obtain token
  29 |     try {
  30 |       const login = await request.post(API_BASE + '/auth/login', { data: { email: 'e2e.api.user@test.local', password: 'TestPass123!' } });
  31 |       if (login.ok()) {
  32 |         const body = await login.json();
  33 |         e2eToken = body?.data?.accessToken ?? body?.accessToken ?? null;
  34 |       }
  35 |     } catch (e) {
  36 |       // proceed unauthenticated
  37 |     }
  38 |   });
  39 | 
  40 |   test('Reports monthly and Analytics overview reflect active currency and API (sw-unregister)', async ({ page, request }) => {
  41 |     const CURRENCIES = ['IDR','USD','SGD','EUR'];
  42 |     const DASHBOARD_STORAGE_KEY = 'cashflow-dashboard-currency';
  43 | 
  44 |     for (const cur of CURRENCIES) {
  45 |       // set currency
  46 |       await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  47 |       await page.evaluate(({ k, c }) => { try { localStorage.setItem(k, c); } catch (e) {} }, { k: DASHBOARD_STORAGE_KEY, c: cur });
  48 | 
  49 |       // Unregister service workers to avoid install/activate races during reload/navigation
  50 |       await page.evaluate(async () => {
  51 |         if ('serviceWorker' in navigator) {
  52 |           const regs = await navigator.serviceWorker.getRegistrations();
  53 |           await Promise.all(regs.map(r => r.unregister()));
  54 |           await new Promise(res => setTimeout(res, 100));
  55 |         }
  56 |       });
  57 | 
  58 |       await page.reload({ waitUntil: 'networkidle' });
  59 | 
  60 |       // Reports
  61 |       await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
  62 |       const opts: any = {};
  63 |       if (e2eToken) opts.headers = { Authorization: `Bearer ${e2eToken}` };
  64 |       const r = await request.get(API_BASE + `/reports/monthly?startDate=2020-01-01&endDate=2030-12-31&currency=${cur}`, opts);
  65 |       expect(r.ok()).toBeTruthy();
  66 |       const rb = await r.json();
  67 |       const txCount = rb?.summary?.transactions ?? null;
  68 |       console.log(`reports.monthly ${cur} => transactions=${txCount}`);
  69 |       if (txCount != null) {
  70 |         const expected = txCount.toLocaleString('id-ID');
  71 |         // wait for formatted string (if UI shows it for the selected range)
  72 |         try { await page.waitForSelector(`text=${expected}`, { timeout: 5000 }); } catch {}
  73 |       }
  74 | 
  75 |       // Analytics
> 76 |       await page.goto(BASE + '/analytics', { waitUntil: 'networkidle' });
     |                  ^ Error: page.goto: Test timeout of 120000ms exceeded.
  77 |       const a = await request.get(API_BASE + `/analytics/overview?startDate=2020-01-01&endDate=2030-12-31&currency=${cur}`, opts);
  78 |       expect(a.ok()).toBeTruthy();
  79 |       const ab = await a.json();
  80 |       console.log(`analytics.overview ${cur} => transactions=${ab?.transactions} income=${ab?.income} expense=${ab?.expense}`);
  81 |       if (ab?.transactions != null) {
  82 |         const expectedA = ab.transactions.toLocaleString('id-ID');
  83 |         try { await page.waitForSelector(`text=${expectedA}`, { timeout: 5000 }); } catch {}
  84 |       }
  85 |     }
  86 |   });
  87 | });
  88 | 
```