import { test, expect } from '@playwright/test';
import { Pool, type PoolClient } from 'pg';

test.setTimeout(120000);

/**
 * E2E Playwright test: Transactions page month filter + backend filtering verification
 *
 * Requirements to run:
 * - Backend and Frontend servers must be running and pointed at the same test DATABASE.
 *   - Backend should be reachable at the BASE_URL environment variable (default: http://localhost:3002)
 *   - DATABASE_URL (or TEST_DATABASE_URL) must point to a dedicated test Postgres instance that the test can modify.
 * - This test will insert and later remove test rows in the database. Do NOT run against production.
 *
 * Usage:
 *   BASE_URL=http://localhost:3002 DATABASE_URL=postgres://user:pass@localhost:5432/cashflow_test npx playwright test playwright/transactions-e2e.spec.ts
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3002';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3101/api/v1';
const E2E_EMAIL = process.env.E2E_EMAIL ?? 'e2e@test.local';
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'TestPass123!';
const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) {
  console.warn('No DATABASE_URL/TEST_DATABASE_URL provided; the test will fail unless set.');
}

// Fixed UUIDs for deterministic cleanup
const USER_ID = '00000000-0000-0000-0000-000000000001';
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000002';
const CATEGORY_ID = '00000000-0000-0000-0000-000000000003';
const TX_CURR_ID = '00000000-0000-0000-0000-000000000011';
const TX_PREV_ID = '00000000-0000-0000-0000-000000000012';

/**
 * Deterministic cleanup of all test rows referencing the fixed fixture IDs.
 * Order matters: child tables (FK -> users/accounts/categories) are removed
 * before their parents; user_settings is FK-RESTRICT to users so it must be
 * removed before the user itself. No CASCADE is used.
 */
async function deleteUserArtifacts(client: PoolClient) {
  // transactions: leaf rows referencing the fixture account (scoped to the
  // fixture user so rows created by the UI/API during any test run are removed)
  await client.query('DELETE FROM transactions WHERE user_id = $1', [USER_ID]);
  await client.query('DELETE FROM transactions WHERE id = ANY($1)', [[TX_CURR_ID, TX_PREV_ID]]);
  await client.query('DELETE FROM transactions WHERE account_id = $1', [ACCOUNT_ID]);
  // child tables with FK -> users (and some -> accounts/categories): remove before parents
  await client.query('DELETE FROM sessions WHERE user_id = $1', [USER_ID]);
  await client.query('DELETE FROM "Bill" WHERE user_id = $1', [USER_ID]);
  await client.query('DELETE FROM saving_goals WHERE user_id = $1', [USER_ID]);
  await client.query('DELETE FROM investments WHERE user_id = $1', [USER_ID]);
  await client.query('DELETE FROM budgets WHERE user_id = $1', [USER_ID]);
  // accounts/categories: parents of transactions/bills/saving_goals/investments/budgets
  await client.query('DELETE FROM accounts WHERE id = $1 OR user_id = $2', [ACCOUNT_ID, USER_ID]);
  await client.query('DELETE FROM categories WHERE id = $1 OR user_id = $2', [CATEGORY_ID, USER_ID]);
  // remaining FK-RESTRICT children of users
  await client.query('DELETE FROM notifications WHERE user_id = $1', [USER_ID]);
  await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [USER_ID]);
  await client.query('DELETE FROM oauth_accounts WHERE user_id = $1', [USER_ID]);
  await client.query('DELETE FROM audit_logs WHERE user_id = $1', [USER_ID]);
  await client.query('DELETE FROM user_settings WHERE user_id = $1', [USER_ID]);
  // finally the user itself
  await client.query('DELETE FROM users WHERE id = $1 OR email = $2', [USER_ID, E2E_EMAIL]);
}

async function seedDb() {
  if (!DB_URL) return;
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  try {
    // cleanup any previous test artifacts with same identifiers
    await client.query('BEGIN');
    await deleteUserArtifacts(client);

    // create user
    await client.query(
      `INSERT INTO users (id, email, username, full_name, password_hash, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', now(), now())
       ON CONFLICT (email) DO NOTHING`,
      [USER_ID, E2E_EMAIL, 'e2euser', 'E2E User', 'e2etesthash'],
    );

    // create account (USD to match the dashboard currency the UI requests)
    await client.query(
      `INSERT INTO accounts (id, user_id, name, account_type, currency, opening_balance_cents, current_balance_cents, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 0, 0, now(), now()) ON CONFLICT (id) DO NOTHING`,
      [ACCOUNT_ID, USER_ID, 'E2E Account', 'CASH', 'USD'],
    );

    // create category
    await client.query(
      `INSERT INTO categories (id, user_id, name, type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now()) ON CONFLICT (id) DO NOTHING`,
      [CATEGORY_ID, USER_ID, 'E2E Category', 'EXPENSE'],
    );

    // compute dates: one in current month, one in previous month
    const now = new Date();
    const currDate = new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0, 0); // middle of current month
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0, 0);

    // insert transactions
    await client.query(
      `INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) ON CONFLICT (id) DO NOTHING`,
      [TX_CURR_ID, USER_ID, ACCOUNT_ID, CATEGORY_ID, 'EXPENSE', 10000, currDate.toISOString()],
    );

    await client.query(
      `INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) ON CONFLICT (id) DO NOTHING`,
      [TX_PREV_ID, USER_ID, ACCOUNT_ID, CATEGORY_ID, 'EXPENSE', 20000, prevDate.toISOString()],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function cleanupDb() {
  if (!DB_URL) return;
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // deterministic FK order: leaf tables first, then parents (see deleteUserArtifacts)
    await deleteUserArtifacts(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

test.describe('Transactions page month-scoped filtering (E2E)', () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test.afterAll(async () => {
    await cleanupDb();
  });

  test('initial render applies current-month fromDate/toDate and backend returns only current-month transactions', async ({ page, request }) => {
    // Inject client-side instrumentation to capture fetch/XHR calls with stack traces/timestamps
    await page.addInitScript(() => {
      try {
        (window as any).__cf_network = [];

        const record = (entry: any) => {
          try { (window as any).__cf_network.push(entry); } catch (e) { }
        };

        const origFetch = window.fetch.bind(window as any);
        window.fetch = async (...args: any[]) => {
          const start = Date.now();
          const stack = new Error().stack;
          const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
          const method = args && args[1] && args[1].method ? args[1].method : 'GET';
          let res;
          try {
            res = await origFetch(...args);
          } catch (err) {
            record({ transport: 'fetch', url, method, error: String(err), start, stack });
            throw err;
          }
          const end = Date.now();
          let body = null;
          try { body = await res.clone().json(); } catch (e) { try { body = await res.clone().text(); } catch (_) { body = null; } }
          record({ transport: 'fetch', url, method, start, end, duration: end - start, status: res.status, body, stack });
          return res;
        };

        // XHR hook
        const OrigX = (window as any).XMLHttpRequest;
        function ProxyXHR(this: any) {
          const xhr = new OrigX();
          const origOpen = xhr.open;
          const origSend = xhr.send;
          let _url = '';
          let _method = '';
          xhr.open = function (method: any, url: any) {
            _url = url;
            _method = method;
            return origOpen.apply(this, arguments as any);
          };
          xhr.send = function (body: any) {
            const start = Date.now();
            const stack = new Error().stack;
            this.addEventListener('load', function () {
              try {
                let responseBody = null;
                try { responseBody = JSON.parse(this.responseText); } catch (e) { responseBody = this.responseText; }
                record({ transport: 'xhr', url: _url, method: _method || 'GET', status: this.status, start, end: Date.now(), duration: Date.now() - start, body: responseBody, stack });
              } catch (e) {}
            });
            try {
              return origSend.apply(this, arguments as any);
            } catch (err) {
              record({ transport: 'xhr', url: _url, method: _method || 'GET', error: String(err), start, stack });
              throw err;
            }
          };
          return xhr;
        }
        (window as any).XMLHttpRequest = ProxyXHR as any;
      } catch (e) {
        // ignore instrumentation errors
      }
    });

    // Prepare UI auth: prefer E2E_ACCESS_TOKEN if provided (allows running tests without managing password hashes).
    let token = undefined;
    let refresh = undefined;
    let userObj = undefined;

    if (process.env.E2E_ACCESS_TOKEN) {
      token = process.env.E2E_ACCESS_TOKEN;
      refresh = process.env.E2E_REFRESH_TOKEN ?? '';
      try {
        userObj = process.env.E2E_USER ? JSON.parse(process.env.E2E_USER) : { id: USER_ID, name: 'E2E User', email: E2E_EMAIL };
      } catch (e) {
        userObj = { id: USER_ID, name: 'E2E User', email: E2E_EMAIL };
      }
    } else {
      // Fall back to API login (requires the seeded user to have the provided password)
      const login = await (request as any).post(`${API_BASE}/auth/login`, { data: { email: E2E_EMAIL, password: E2E_PASSWORD } });
      if (!login.ok()) {
        throw new Error('E2E login failed for ' + E2E_EMAIL + ' — status: ' + login.status());
      }
      const loginBody = await login.json().catch(() => null);
      token = loginBody?.data?.accessToken;
      refresh = loginBody?.data?.refreshToken;
      userObj = loginBody?.user;
    }

    await page.addInitScript((toks) => {
      try {
        localStorage.setItem('cashflow.accessToken', toks.token);
        localStorage.setItem('cashflow.refreshToken', toks.refresh);
        localStorage.setItem('cashflow.user', JSON.stringify(toks.user));
        // Pin the dashboard currency to USD (project currency state mechanism) so
        // the UI requests the same currency the fixture seeds.
        localStorage.setItem('cashflow-dashboard-currency', 'USD');
        sessionStorage.removeItem('cashflow-dashboard-currency');
      } catch (e) {}
    }, { token, refresh, user: userObj });

    // compute expected fromDate and toDate strings (YYYY-MM-DD)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const expectedFrom = fmt(start);
    const expectedTo = fmt(end);

    // Attach request/response capture for diagnostics
    const capturedRequests: any[] = [];
    page.on('request', (r) => {
      try {
        capturedRequests.push({ type: 'request', url: r.url(), method: r.method(), headers: r.headers(), postData: r.postData() });
      } catch (e) {}
    });
    page.on('response', async (res) => {
      try {
        const url = res.url();
        let body = null;
        try { body = await res.clone().json(); } catch (e) { try { body = await res.text(); } catch (_) { body = null; } }
        capturedRequests.push({ type: 'response', url, status: res.status(), body });
      } catch (e) {}
    });

    // Attach a CDP session to capture requestWillBeSent with initiator info (Chromium-only)
    let cdpEvents: any[] = [];
    try {
      // @ts-ignore - playwright types allow newCDPSession
      const session = await page.context().newCDPSession(page);
      await session.send('Network.enable');
      session.on('Network.requestWillBeSent', (e: any) => {
        try {
          cdpEvents.push({ url: e.request.url, initiator: e.initiator, timestamp: Date.now(), requestId: e.requestId });
        } catch (err) {}
      });
    } catch (e) {
      // not available in non-chromium contexts
    }

    // Start capturing the /transactions API response (XHR/fetch JSON only; excludes
    // page navigations and Next.js RSC prefetches that also contain "/transactions")
    const transactionsResponse = page.waitForResponse((res) => {
      try {
        const url = res.url();
        if (!url.includes('/api/v1/transactions')) return false;
        const r = res.request();
        const rt = r.resourceType ? r.resourceType() : '';
        const ct = (res.headers && res.headers()['content-type']) || '';
        return rt === 'xhr' || rt === 'fetch' || ct.includes('application/json');
      } catch (e) {
        return false;
      }
    }, { timeout: 15000 });

    // Navigate to transactions page (the app may server-render /transactions or fetch client-side)
    await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });

    // Wait for the transactions UI to render: either table rows or skeleton states or an explicit "No transactions" message
    try {
      await page.waitForSelector('table [data-transaction-id]', { timeout: 20000 });
    } catch (e) {
      try {
        await page.waitForSelector('.table-skeleton, .card-skeleton', { timeout: 5000 });
      } catch (e2) {
        // last resort: wait for a textual no-results indicator
        await page.waitForSelector('text=No transactions', { timeout: 5000 });
      }
    }

    // Use the /transactions API request URL (carries fromDate/toDate/currency
    // filters) as the canonical URL and its response body for assertions
    const resp = await transactionsResponse;
    const url = resp.request().url();

    // Print captured requests for diagnostics
    try {
      console.log('PLAYWRIGHT CAPTURED_NETWORK (node):', JSON.stringify((globalThis as any).capturedRequests || capturedRequests || [], null, 2));
    } catch (e) {
      try { console.log('PLAYWRIGHT CAPTURED_NETWORK (node fallback):', capturedRequests); } catch {};
    }

    // Also retrieve in-browser instrumentation recorded by addInitScript (fetch/XHR with stacks)
    try {
      const inBrowser = await page.evaluate(() => (window as any).__cf_network || []);
      console.log('PLAYWRIGHT IN-BROWSER NETWORK:', JSON.stringify(inBrowser, null, 2));
    } catch (e) {
      console.log('PLAYWRIGHT IN-BROWSER NETWORK: <failed to read>');
    }

    // Print CDP-captured initiator events
    try {
      console.log('PLAYWRIGHT CDP EVENTS:', JSON.stringify(cdpEvents || [], null, 2));
    } catch (e) {
      console.log('PLAYWRIGHT CDP EVENTS: <failed to read>');
    }

    // Assert URL has fromDate and toDate query params matching the current month
    expect(url).toContain(`fromDate=${expectedFrom}`);
    expect(url).toContain(`toDate=${expectedTo}`);

    // Assert backend returned only current-month transactions
    const body = await resp.json().catch(() => null);
    expect(body).not.toBeNull();
    // Expect pagination.totalItems to be 1 (only the tx in current month)
    expect(body.pagination).toBeDefined();
    expect(body.pagination.totalItems).toBe(1);
    expect(Array.isArray(body.data)).toBeTruthy();
    expect(body.data.length).toBeGreaterThan(0);

    // UI: verify toolbar count shows 1 transaksi
    await page.waitForSelector(`text=/^\\d+ transaksi$/`, { timeout: 5000 });
    const toolbarText = await page.getByText(/^\d+ transaksi$/).first().textContent();
    expect(toolbarText).toContain('1');

    // UI: verify table contains the inserted transaction's date
    // The frontend formats transaction date via formatTransactionDate using the
    // browser locale/timezone; replicate it in the browser so it always matches.
    const expectedUiDate = await page.evaluate(() => {
      const sample = new Date();
      const d = new Date(sample.getFullYear(), sample.getMonth(), 15, 12, 0, 0, 0);
      const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'id-ID';
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const dateFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });
      const timeFormatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
      return `${dateFormatter.format(d)} • ${timeFormatter.format(d)}`;
    });

    // Wait for table row date cell to contain expectedUiDate
    await page.waitForSelector(`text=${expectedUiDate}`, { timeout: 5000 });
    const dateCell = await page.locator(`text=${expectedUiDate}`).first().textContent();
    expect(dateCell).toBeTruthy();
  });
});

