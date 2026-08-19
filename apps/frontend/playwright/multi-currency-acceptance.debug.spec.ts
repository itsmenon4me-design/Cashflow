import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

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

const EXPECTED = { IDR: 4, USD: 4, SGD: 3, EUR: 5 };

test.describe('Multi-currency acceptance (debug)', () => {
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

    try {
      const login = await request.post(API_BASE + '/auth/login', {
        data: { email: 'e2e.api.user@test.local', password: 'TestPass123!' },
      });
      if (login.ok()) {
        const body = await login.json();
        e2eToken = body.data.accessToken;
        e2eUser = body.user;
      }
    } catch (e) {
      console.warn('login failed', e);
    }
  });

  test('debug - log responses', async ({ page }) => {
    await page.goto(BASE + '/');
    if (e2eToken && e2eUser) {
      await page.evaluate((toks, user) => {
        localStorage.setItem('cashflow.accessToken', toks);
        localStorage.setItem('cashflow.user', JSON.stringify(user));
      }, e2eToken, e2eUser);
    }
    await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });

    page.on('response', async (res) => {
      try {
        const url = res.url();
        const status = res.status();
        const method = res.request().method();
        console.log('[RESP]', method, status, url);
      } catch (e) {}
    });

    // set currency to IDR and reload
    await page.evaluate(() => localStorage.setItem('cashflow-dashboard-currency', 'IDR'));
    await page.reload({ waitUntil: 'networkidle' });

    // wait some time to capture responses
    await page.waitForTimeout(3000);
  });
});
