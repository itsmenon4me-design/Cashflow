import { test, expect } from '@playwright/test';
import { Pool } from 'pg';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
if (!DB_URL) console.warn('No TEST_DATABASE_URL provided; the tests will fail unless set.');

// Deterministic IDs
const USER_A = '10000000-0000-0000-0000-000000000001';
const USER_B = '20000000-0000-0000-0000-000000000002';
const ACC_USD = '11000000-0000-0000-0000-000000000011';
const ACC_SGD = '12000000-0000-0000-0000-000000000012';
const ACC_EUR = '13000000-0000-0000-0000-000000000013';
const ACC_B_USD = '21000000-0000-0000-0000-000000000021';
const CAT_A = '30000000-0000-0000-0000-000000000031';
const TX_USD_1 = '40000000-0000-0000-0000-000000000041';
const TX_USD_2 = '40000000-0000-0000-0000-000000000042';
const TX_SGD_1 = '40000000-0000-0000-0000-000000000051';
const TX_SGD_2 = '40000000-0000-0000-0000-000000000052';
const TX_EUR_1 = '40000000-0000-0000-0000-000000000061';
const TX_B_USD = '50000000-0000-0000-0000-000000000071';

async function seedCurrencyData() {
  if (!DB_URL) return;
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM transactions WHERE id = ANY($1)', [[TX_USD_1, TX_USD_2, TX_SGD_1, TX_SGD_2, TX_EUR_1, TX_B_USD]]);
    await client.query('DELETE FROM accounts WHERE id = ANY($1)', [[ACC_USD, ACC_SGD, ACC_EUR, ACC_B_USD]]);
    await client.query('DELETE FROM categories WHERE id = $1', [CAT_A]);
    await client.query('DELETE FROM users WHERE id = ANY($1)', [[USER_A, USER_B]]);

    await client.query(`INSERT INTO users (id, email, username, full_name, password_hash, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', now(), now()) ON CONFLICT (id) DO NOTHING`, [USER_A, 'e2e+a@test.local', 'e2ea', 'E2E A', 'pw']);
    await client.query(`INSERT INTO users (id, email, username, full_name, password_hash, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', now(), now()) ON CONFLICT (id) DO NOTHING`, [USER_B, 'e2e+b@test.local', 'e2eb', 'E2E B', 'pw']);

    await client.query(`INSERT INTO categories (id, user_id, name, type, created_at, updated_at) VALUES ($1, $2, $3, $4, now(), now()) ON CONFLICT (id) DO NOTHING`, [CAT_A, USER_A, 'E2E Cat', 'EXPENSE']);

    await client.query(`INSERT INTO accounts (id, user_id, name, account_type, currency, opening_balance_cents, current_balance_cents, created_at, updated_at) VALUES
      ($1, $2, 'USD Acc', 'CASH', 'USD', 0, 0, now(), now()), ($3, $2, 'SGD Acc', 'CASH', 'SGD', 0, 0, now(), now()), ($4, $2, 'EUR Acc', 'CASH', 'EUR', 0, 0, now(), now()) ON CONFLICT (id) DO NOTHING`, [ACC_USD, USER_A, ACC_SGD, ACC_EUR]);

    // account for User B (USD)
    await client.query(`INSERT INTO accounts (id, user_id, name, account_type, currency, opening_balance_cents, current_balance_cents, created_at, updated_at) VALUES ($1, $2, 'B USD', 'CASH', 'USD', 0, 0, now(), now()) ON CONFLICT (id) DO NOTHING`, [ACC_B_USD, USER_B]);

    const now = new Date();
    const d = now.toISOString();

    await client.query(`INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at) VALUES ($1,$2,$3,$4,'EXPENSE',1000,$5, now(), now()) ON CONFLICT (id) DO NOTHING`, [TX_USD_1, USER_A, ACC_USD, CAT_A, d]);
    await client.query(`INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at) VALUES ($1,$2,$3,$4,'EXPENSE',2000,$5, now(), now()) ON CONFLICT (id) DO NOTHING`, [TX_USD_2, USER_A, ACC_USD, CAT_A, d]);

    await client.query(`INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at) VALUES ($1,$2,$3,$4,'EXPENSE',1100,$5, now(), now()) ON CONFLICT (id) DO NOTHING`, [TX_SGD_1, USER_A, ACC_SGD, CAT_A, d]);
    await client.query(`INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at) VALUES ($1,$2,$3,$4,'EXPENSE',2200,$5, now(), now()) ON CONFLICT (id) DO NOTHING`, [TX_SGD_2, USER_A, ACC_SGD, CAT_A, d]);

    await client.query(`INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at) VALUES ($1,$2,$3,$4,'EXPENSE',1300,$5, now(), now()) ON CONFLICT (id) DO NOTHING`, [TX_EUR_1, USER_A, ACC_EUR, CAT_A, d]);

    await client.query(`INSERT INTO transactions (id, user_id, account_id, category_id, transaction_type, amount_cents, transaction_date, created_at, updated_at) VALUES ($1,$2,$3,$4,'EXPENSE',900,$5, now(), now()) ON CONFLICT (id) DO NOTHING`, [TX_B_USD, USER_B, ACC_B_USD, CAT_A, d]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

async function cleanupCurrencyData() {
  if (!DB_URL) return;
  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM transactions WHERE id = ANY($1)', [[TX_USD_1, TX_USD_2, TX_SGD_1, TX_SGD_2, TX_EUR_1, TX_B_USD]]);
    await client.query('DELETE FROM accounts WHERE id = ANY($1)', [[ACC_USD, ACC_SGD, ACC_EUR, ACC_B_USD]]);
    await client.query('DELETE FROM categories WHERE id = $1', [CAT_A]);
    await client.query('DELETE FROM users WHERE id = ANY($1)', [[USER_A, USER_B]]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

test.describe('Transactions currency isolation (E2E)', () => {
  test.beforeAll(async () => {
    await seedCurrencyData();
  });
  test.afterAll(async () => {
    await cleanupCurrencyData();
  });

  test('switching dashboard currency updates transactions request and results', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.evaluate(() => {
      try {
        localStorage.setItem('cashflow.accessToken', 'e2e-dummy-token');
        localStorage.setItem('cashflow.refreshToken', 'e2e-dummy-refresh');
        localStorage.setItem('cashflow.user', JSON.stringify({ id: '10000000-0000-0000-0000-000000000001', name: 'E2E A', email: 'e2e+a@test.local' }));
        sessionStorage.removeItem('cashflow-dashboard-currency');
      } catch (e) {}
    });

    // Open transactions page and wait for the server response that contains transactions JSON
    await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });

    const initialRes = await page.waitForResponse(
      (res) => res.url().includes('/transactions'),
      { timeout: 10000 },
    );
    let firstBody: any = null;
    try { firstBody = await initialRes.json(); } catch (e) { firstBody = null; }

    // initial should be USD and return JSON with pagination
    expect(initialRes.url()).toContain('currency=USD');
    expect(firstBody).not.toBeNull();
    expect(firstBody.pagination.totalItems).toBe(2);
    for (const t of firstBody.data) expect(t.account?.currency || t.currency || 'USD').toBe('USD');

    // switch to SGD via sessionStorage (simulate dashboard switch)
    await page.evaluate(() => { sessionStorage.setItem('cashflow-dashboard-currency', 'SGD'); window.dispatchEvent(new Event('storage')); });
    const sgdRes = await page.waitForResponse(
      (res) => res.url().includes('/transactions') && res.url().includes('currency=SGD') && res.status() === 200 && res.headers()['content-type']?.includes('application/json'),
      { timeout: 5000 },
    );
    const secondBody = await sgdRes.json();
    expect(secondBody.pagination.totalItems).toBe(2);
    for (const t of secondBody.data) expect(t.account?.currency || t.currency).toBe('SGD');

    // switch to EUR
    await page.evaluate(() => { sessionStorage.setItem('cashflow-dashboard-currency', 'EUR'); window.dispatchEvent(new Event('storage')); });
    const eurRes = await page.waitForResponse(
      (res) => res.url().includes('/transactions') && res.url().includes('currency=EUR') && res.status() === 200 && res.headers()['content-type']?.includes('application/json'),
      { timeout: 5000 },
    );
    const thirdBody = await eurRes.json();
    expect(thirdBody.pagination.totalItems).toBe(1);
    for (const t of thirdBody.data) expect(t.account?.currency || t.currency).toBe('EUR');

    // ensure no user B leakage
    expect(firstBody.data.some((x: any) => x.user_id === USER_B)).toBeFalsy();
  });
});
