# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps\frontend\playwright\transactions-e2e.spec.ts >> Transactions page month-scoped filtering (E2E) >> initial render applies current-month fromDate/toDate and backend returns only current-month transactions
- Location: apps\frontend\playwright\transactions-e2e.spec.ts:130:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('text=No transactions') to be visible

```

```
error: update or delete on table "users" violates foreign key constraint "user_settings_user_id_fkey" on table "user_settings"
```

# Test source

```ts
  10  |  * - Backend and Frontend servers must be running and pointed at the same test DATABASE.
  11  |  *   - Backend should be reachable at the BASE_URL environment variable (default: http://localhost:3002)
  12  |  *   - DATABASE_URL (or TEST_DATABASE_URL) must point to a dedicated test Postgres instance that the test can modify.
  13  |  * - This test will insert and later remove test rows in the database. Do NOT run against production.
  14  |  *
  15  |  * Usage:
  16  |  *   BASE_URL=http://localhost:3002 DATABASE_URL=postgres://user:pass@localhost:5432/cashflow_test npx playwright test playwright/transactions-e2e.spec.ts
  17  |  */
  18  | 
  19  | const BASE = process.env.BASE_URL ?? 'http://localhost:3002';
  20  | const API_BASE = process.env.API_BASE ?? 'http://localhost:3101/api/v1';
  21  | const E2E_EMAIL = process.env.E2E_EMAIL ?? 'e2e@test.local';
  22  | const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'TestPass123!';
  23  | const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  24  | if (!DB_URL) {
  25  |   console.warn('No DATABASE_URL/TEST_DATABASE_URL provided; the test will fail unless set.');
  26  | }
  27  | 
  28  | // Fixed UUIDs for deterministic cleanup
  29  | const USER_ID = '00000000-0000-0000-0000-000000000001';
  30  | const ACCOUNT_ID = '00000000-0000-0000-0000-000000000002';
  31  | const CATEGORY_ID = '00000000-0000-0000-0000-000000000003';
  32  | const TX_CURR_ID = '00000000-0000-0000-0000-000000000011';
  33  | const TX_PREV_ID = '00000000-0000-0000-0000-000000000012';
  34  | 
  35  | async function seedDb() {
  36  |   if (!DB_URL) return;
  37  |   const pool = new Pool({ connectionString: DB_URL });
  38  |   const client = await pool.connect();
  39  |   try {
  40  |     // cleanup any previous test artifacts with same identifiers
  41  |     await client.query('BEGIN');
  42  |     await client.query('DELETE FROM transactions WHERE id = ANY($1)', [[TX_CURR_ID, TX_PREV_ID]]);
  43  |     await client.query('DELETE FROM accounts WHERE id = $1', [ACCOUNT_ID]);
  44  |     await client.query('DELETE FROM categories WHERE id = $1', [CATEGORY_ID]);
  45  |     await client.query('DELETE FROM users WHERE id = $1 OR email = $2', [USER_ID, E2E_EMAIL]);
  46  | 
  47  |     // create user
  48  |     await client.query(
  49  |       `INSERT INTO users (id, email, username, full_name, password_hash, status, created_at, updated_at)
  50  |        VALUES ($1, $2, $3, $4, $5, 'ACTIVE', now(), now())
  51  |        ON CONFLICT (email) DO NOTHING`,
  52  |       [USER_ID, E2E_EMAIL, 'e2euser', 'E2E User', 'e2etesthash'],
  53  |     );
  54  | 
  55  |     // create account
  56  |     await client.query(
  57  |       `INSERT INTO accounts (id, user_id, name, account_type, currency, opening_balance_cents, current_balance_cents, created_at, updated_at)
  58  |        VALUES ($1, $2, $3, $4, $5, 0, 0, now(), now()) ON CONFLICT (id) DO NOTHING`,
  59  |       [ACCOUNT_ID, USER_ID, 'E2E Account', 'CASH', 'IDR'],
  60  |     );
  61  | 
  62  |     // create category
  63  |     await client.query(
  64  |       `INSERT INTO categories (id, user_id, name, type, created_at, updated_at)
  65  |        VALUES ($1, $2, $3, $4, now(), now()) ON CONFLICT (id) DO NOTHING`,
  66  |       [CATEGORY_ID, USER_ID, 'E2E Category', 'EXPENSE'],
  67  |     );
  68  | 
  69  |     // compute dates: one in current month, one in previous month
  70  |     const now = new Date();
  71  |     const currDate = new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0, 0); // middle of current month
  72  |     const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0, 0);
  73  | 
  74  |     // insert transactions
  75  |     await client.query(
  76  |       `INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at)
  77  |        VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) ON CONFLICT (id) DO NOTHING`,
  78  |       [TX_CURR_ID, USER_ID, ACCOUNT_ID, CATEGORY_ID, 'EXPENSE', 10000, currDate.toISOString()],
  79  |     );
  80  | 
  81  |     await client.query(
  82  |       `INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at)
  83  |        VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) ON CONFLICT (id) DO NOTHING`,
  84  |       [TX_PREV_ID, USER_ID, ACCOUNT_ID, CATEGORY_ID, 'EXPENSE', 20000, prevDate.toISOString()],
  85  |     );
  86  | 
  87  |     await client.query('COMMIT');
  88  |   } catch (err) {
  89  |     await client.query('ROLLBACK');
  90  |     throw err;
  91  |   } finally {
  92  |     client.release();
  93  |     await pool.end();
  94  |   }
  95  | }
  96  | 
  97  | async function cleanupDb() {
  98  |   if (!DB_URL) return;
  99  |   const pool = new Pool({ connectionString: DB_URL });
  100 |   const client = await pool.connect();
  101 |   try {
  102 |     await client.query('BEGIN');
  103 |     // remove transactions by known ids and any remaining transactions referencing the test account
  104 |     await client.query('DELETE FROM transactions WHERE id = ANY($1)', [[TX_CURR_ID, TX_PREV_ID]]);
  105 |     await client.query('DELETE FROM transactions WHERE account_id = $1', [ACCOUNT_ID]);
  106 |     // remove any accounts that reference the user (by id or by user_id) to avoid FK violations
  107 |     await client.query('DELETE FROM accounts WHERE id = $1 OR user_id = $2', [ACCOUNT_ID, USER_ID]);
  108 |     // remove categories associated with the user as well
  109 |     await client.query('DELETE FROM categories WHERE id = $1 OR user_id = $2', [CATEGORY_ID, USER_ID]);
> 110 |     await client.query('DELETE FROM users WHERE id = $1 OR email = $2', [USER_ID, E2E_EMAIL]);
      |     ^ error: update or delete on table "users" violates foreign key constraint "user_settings_user_id_fkey" on table "user_settings"
  111 |     await client.query('COMMIT');
  112 |   } catch (err) {
  113 |     await client.query('ROLLBACK');
  114 |     throw err;
  115 |   } finally {
  116 |     client.release();
  117 |     await pool.end();
  118 |   }
  119 | }
  120 | 
  121 | test.describe('Transactions page month-scoped filtering (E2E)', () => {
  122 |   test.beforeAll(async () => {
  123 |     await seedDb();
  124 |   });
  125 | 
  126 |   test.afterAll(async () => {
  127 |     await cleanupDb();
  128 |   });
  129 | 
  130 |   test('initial render applies current-month fromDate/toDate and backend returns only current-month transactions', async ({ page, request }) => {
  131 |     // Inject client-side instrumentation to capture fetch/XHR calls with stack traces/timestamps
  132 |     await page.addInitScript(() => {
  133 |       try {
  134 |         (window as any).__cf_network = [];
  135 | 
  136 |         const record = (entry: any) => {
  137 |           try { (window as any).__cf_network.push(entry); } catch (e) { }
  138 |         };
  139 | 
  140 |         const origFetch = window.fetch.bind(window as any);
  141 |         window.fetch = async (...args: any[]) => {
  142 |           const start = Date.now();
  143 |           const stack = new Error().stack;
  144 |           const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
  145 |           const method = args && args[1] && args[1].method ? args[1].method : 'GET';
  146 |           let res;
  147 |           try {
  148 |             res = await origFetch(...args);
  149 |           } catch (err) {
  150 |             record({ transport: 'fetch', url, method, error: String(err), start, stack });
  151 |             throw err;
  152 |           }
  153 |           const end = Date.now();
  154 |           let body = null;
  155 |           try { body = await res.clone().json(); } catch (e) { try { body = await res.clone().text(); } catch (_) { body = null; } }
  156 |           record({ transport: 'fetch', url, method, start, end, duration: end - start, status: res.status, body, stack });
  157 |           return res;
  158 |         };
  159 | 
  160 |         // XHR hook
  161 |         const OrigX = (window as any).XMLHttpRequest;
  162 |         function ProxyXHR(this: any) {
  163 |           const xhr = new OrigX();
  164 |           const origOpen = xhr.open;
  165 |           const origSend = xhr.send;
  166 |           let _url = '';
  167 |           let _method = '';
  168 |           xhr.open = function (method: any, url: any) {
  169 |             _url = url;
  170 |             _method = method;
  171 |             return origOpen.apply(this, arguments as any);
  172 |           };
  173 |           xhr.send = function (body: any) {
  174 |             const start = Date.now();
  175 |             const stack = new Error().stack;
  176 |             this.addEventListener('load', function () {
  177 |               try {
  178 |                 let responseBody = null;
  179 |                 try { responseBody = JSON.parse(this.responseText); } catch (e) { responseBody = this.responseText; }
  180 |                 record({ transport: 'xhr', url: _url, method: _method || 'GET', status: this.status, start, end: Date.now(), duration: Date.now() - start, body: responseBody, stack });
  181 |               } catch (e) {}
  182 |             });
  183 |             try {
  184 |               return origSend.apply(this, arguments as any);
  185 |             } catch (err) {
  186 |               record({ transport: 'xhr', url: _url, method: _method || 'GET', error: String(err), start, stack });
  187 |               throw err;
  188 |             }
  189 |           };
  190 |           return xhr;
  191 |         }
  192 |         (window as any).XMLHttpRequest = ProxyXHR as any;
  193 |       } catch (e) {
  194 |         // ignore instrumentation errors
  195 |       }
  196 |     });
  197 | 
  198 |     // Prepare UI auth: prefer E2E_ACCESS_TOKEN if provided (allows running tests without managing password hashes).
  199 |     let token = undefined;
  200 |     let refresh = undefined;
  201 |     let userObj = undefined;
  202 | 
  203 |     if (process.env.E2E_ACCESS_TOKEN) {
  204 |       token = process.env.E2E_ACCESS_TOKEN;
  205 |       refresh = process.env.E2E_REFRESH_TOKEN ?? '';
  206 |       try {
  207 |         userObj = process.env.E2E_USER ? JSON.parse(process.env.E2E_USER) : { id: USER_ID, name: 'E2E User', email: E2E_EMAIL };
  208 |       } catch (e) {
  209 |         userObj = { id: USER_ID, name: 'E2E User', email: E2E_EMAIL };
  210 |       }
```