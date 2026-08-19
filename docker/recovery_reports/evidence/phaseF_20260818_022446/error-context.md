# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps\frontend\playwright\transactions-e2e.spec.ts >> Transactions page month-scoped filtering (E2E) >> initial render applies current-month fromDate/toDate and backend returns only current-month transactions
- Location: apps\frontend\playwright\transactions-e2e.spec.ts:123:7

# Error details

```
error: update or delete on table "users" violates foreign key constraint "accounts_user_id_fkey" on table "accounts"
```

```
error: update or delete on table "users" violates foreign key constraint "accounts_user_id_fkey" on table "accounts"
```

# Test source

```ts
  3   | 
  4   | test.setTimeout(120000);
  5   | 
  6   | /**
  7   |  * E2E Playwright test: Transactions page month filter + backend filtering verification
  8   |  *
  9   |  * Requirements to run:
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
  20  | const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  21  | if (!DB_URL) {
  22  |   console.warn('No DATABASE_URL/TEST_DATABASE_URL provided; the test will fail unless set.');
  23  | }
  24  | 
  25  | // Fixed UUIDs for deterministic cleanup
  26  | const USER_ID = '00000000-0000-0000-0000-000000000001';
  27  | const ACCOUNT_ID = '00000000-0000-0000-0000-000000000002';
  28  | const CATEGORY_ID = '00000000-0000-0000-0000-000000000003';
  29  | const TX_CURR_ID = '00000000-0000-0000-0000-000000000011';
  30  | const TX_PREV_ID = '00000000-0000-0000-0000-000000000012';
  31  | 
  32  | async function seedDb() {
  33  |   if (!DB_URL) return;
  34  |   const pool = new Pool({ connectionString: DB_URL });
  35  |   const client = await pool.connect();
  36  |   try {
  37  |     // cleanup any previous test artifacts with same identifiers
  38  |     await client.query('BEGIN');
  39  |     await client.query('DELETE FROM transactions WHERE id = ANY($1)', [[TX_CURR_ID, TX_PREV_ID]]);
  40  |     await client.query('DELETE FROM accounts WHERE id = $1', [ACCOUNT_ID]);
  41  |     await client.query('DELETE FROM categories WHERE id = $1', [CATEGORY_ID]);
  42  |     await client.query('DELETE FROM users WHERE id = $1 OR email = $2', [USER_ID, 'e2e@test.local']);
  43  | 
  44  |     // create user
  45  |     await client.query(
  46  |       `INSERT INTO users (id, email, username, full_name, password_hash, status, created_at, updated_at)
  47  |        VALUES ($1, $2, $3, $4, $5, 'ACTIVE', now(), now())
  48  |        ON CONFLICT (email) DO NOTHING`,
  49  |       [USER_ID, 'e2e@test.local', 'e2euser', 'E2E User', 'e2etesthash'],
  50  |     );
  51  | 
  52  |     // create account
  53  |     await client.query(
  54  |       `INSERT INTO accounts (id, user_id, name, account_type, currency, opening_balance_cents, current_balance_cents, created_at, updated_at)
  55  |        VALUES ($1, $2, $3, $4, $5, 0, 0, now(), now()) ON CONFLICT (id) DO NOTHING`,
  56  |       [ACCOUNT_ID, USER_ID, 'E2E Account', 'CASH', 'IDR'],
  57  |     );
  58  | 
  59  |     // create category
  60  |     await client.query(
  61  |       `INSERT INTO categories (id, user_id, name, type, created_at, updated_at)
  62  |        VALUES ($1, $2, $3, $4, now(), now()) ON CONFLICT (id) DO NOTHING`,
  63  |       [CATEGORY_ID, USER_ID, 'E2E Category', 'EXPENSE'],
  64  |     );
  65  | 
  66  |     // compute dates: one in current month, one in previous month
  67  |     const now = new Date();
  68  |     const currDate = new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0, 0); // middle of current month
  69  |     const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0, 0);
  70  | 
  71  |     // insert transactions
  72  |     await client.query(
  73  |       `INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at)
  74  |        VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) ON CONFLICT (id) DO NOTHING`,
  75  |       [TX_CURR_ID, USER_ID, ACCOUNT_ID, CATEGORY_ID, 'EXPENSE', 10000, currDate.toISOString()],
  76  |     );
  77  | 
  78  |     await client.query(
  79  |       `INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at)
  80  |        VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) ON CONFLICT (id) DO NOTHING`,
  81  |       [TX_PREV_ID, USER_ID, ACCOUNT_ID, CATEGORY_ID, 'EXPENSE', 20000, prevDate.toISOString()],
  82  |     );
  83  | 
  84  |     await client.query('COMMIT');
  85  |   } catch (err) {
  86  |     await client.query('ROLLBACK');
  87  |     throw err;
  88  |   } finally {
  89  |     client.release();
  90  |     await pool.end();
  91  |   }
  92  | }
  93  | 
  94  | async function cleanupDb() {
  95  |   if (!DB_URL) return;
  96  |   const pool = new Pool({ connectionString: DB_URL });
  97  |   const client = await pool.connect();
  98  |   try {
  99  |     await client.query('BEGIN');
  100 |     await client.query('DELETE FROM transactions WHERE id = ANY($1)', [[TX_CURR_ID, TX_PREV_ID]]);
  101 |     await client.query('DELETE FROM accounts WHERE id = $1', [ACCOUNT_ID]);
  102 |     await client.query('DELETE FROM categories WHERE id = $1', [CATEGORY_ID]);
> 103 |     await client.query('DELETE FROM users WHERE id = $1 OR email = $2', [USER_ID, 'e2e@test.local']);
      |     ^ error: update or delete on table "users" violates foreign key constraint "accounts_user_id_fkey" on table "accounts"
  104 |     await client.query('COMMIT');
  105 |   } catch (err) {
  106 |     await client.query('ROLLBACK');
  107 |     throw err;
  108 |   } finally {
  109 |     client.release();
  110 |     await pool.end();
  111 |   }
  112 | }
  113 | 
  114 | test.describe('Transactions page month-scoped filtering (E2E)', () => {
  115 |   test.beforeAll(async () => {
  116 |     await seedDb();
  117 |   });
  118 | 
  119 |   test.afterAll(async () => {
  120 |     await cleanupDb();
  121 |   });
  122 | 
  123 |   test('initial render applies current-month fromDate/toDate and backend returns only current-month transactions', async ({ page }) => {
  124 |     // Inject client-side instrumentation to capture fetch/XHR calls with stack traces/timestamps
  125 |     await page.addInitScript(() => {
  126 |       try {
  127 |         (window as any).__cf_network = [];
  128 | 
  129 |         const record = (entry: any) => {
  130 |           try { (window as any).__cf_network.push(entry); } catch (e) { }
  131 |         };
  132 | 
  133 |         const origFetch = window.fetch.bind(window as any);
  134 |         window.fetch = async (...args: any[]) => {
  135 |           const start = Date.now();
  136 |           const stack = new Error().stack;
  137 |           const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
  138 |           const method = args && args[1] && args[1].method ? args[1].method : 'GET';
  139 |           let res;
  140 |           try {
  141 |             res = await origFetch(...args);
  142 |           } catch (err) {
  143 |             record({ transport: 'fetch', url, method, error: String(err), start, stack });
  144 |             throw err;
  145 |           }
  146 |           const end = Date.now();
  147 |           let body = null;
  148 |           try { body = await res.clone().json(); } catch (e) { try { body = await res.clone().text(); } catch (_) { body = null; } }
  149 |           record({ transport: 'fetch', url, method, start, end, duration: end - start, status: res.status, body, stack });
  150 |           return res;
  151 |         };
  152 | 
  153 |         // XHR hook
  154 |         const OrigX = (window as any).XMLHttpRequest;
  155 |         function ProxyXHR(this: any) {
  156 |           const xhr = new OrigX();
  157 |           const origOpen = xhr.open;
  158 |           const origSend = xhr.send;
  159 |           let _url = '';
  160 |           let _method = '';
  161 |           xhr.open = function (method: any, url: any) {
  162 |             _url = url;
  163 |             _method = method;
  164 |             return origOpen.apply(this, arguments as any);
  165 |           };
  166 |           xhr.send = function (body: any) {
  167 |             const start = Date.now();
  168 |             const stack = new Error().stack;
  169 |             this.addEventListener('load', function () {
  170 |               try {
  171 |                 let responseBody = null;
  172 |                 try { responseBody = JSON.parse(this.responseText); } catch (e) { responseBody = this.responseText; }
  173 |                 record({ transport: 'xhr', url: _url, method: _method || 'GET', status: this.status, start, end: Date.now(), duration: Date.now() - start, body: responseBody, stack });
  174 |               } catch (e) {}
  175 |             });
  176 |             try {
  177 |               return origSend.apply(this, arguments as any);
  178 |             } catch (err) {
  179 |               record({ transport: 'xhr', url: _url, method: _method || 'GET', error: String(err), start, stack });
  180 |               throw err;
  181 |             }
  182 |           };
  183 |           return xhr;
  184 |         }
  185 |         (window as any).XMLHttpRequest = ProxyXHR as any;
  186 |       } catch (e) {
  187 |         // ignore instrumentation errors
  188 |       }
  189 |     });
  190 | 
  191 |     // Prepare UI auth to skip actual login flow (local dev only)
  192 |     await page.goto(BASE + '/');
  193 |     await page.evaluate(() => {
  194 |       try {
  195 |         localStorage.setItem('cashflow.accessToken', 'e2e-dummy-token');
  196 |         localStorage.setItem('cashflow.refreshToken', 'e2e-dummy-refresh');
  197 |         localStorage.setItem('cashflow.user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', name: 'E2E User', email: 'e2e@test.local' }));
  198 |         sessionStorage.removeItem('cashflow-dashboard-currency');
  199 |       } catch (e) {}
  200 |     });
  201 | 
  202 |     // compute expected fromDate and toDate strings (YYYY-MM-DD)
  203 |     const now = new Date();
```