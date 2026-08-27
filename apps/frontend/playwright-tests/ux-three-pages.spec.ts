import { test, expect } from '@playwright/test';

test.setTimeout(120000);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API = process.env.E2E_API_BASE || 'http://localhost:3001/api/v1';
const EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

async function login(request: any) {
  const res = await request.post(API + '/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { token: body.data?.accessToken ?? body.accessToken, user: body.user ?? body.data?.user };
}

async function authPage(page: any, auth: any) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a: any) => {
    localStorage.setItem('cashflow.accessToken', a.token);
    localStorage.setItem('cashflow.user', JSON.stringify(a.user));
    localStorage.setItem('cashflow-dashboard-currency', 'IDR');
  }, auth);
}

async function searchOn(page: any, url: string, term: string) {
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-transaction-id]', { timeout: 20000 });
  const searchInput = page.locator('input[placeholder*="kategori"]').first();
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(term);
  // debounce 300ms + fetch
  await page.waitForTimeout(2500);
  const count = await page.locator('[data-transaction-id]').count();
  await page.screenshot({ path: `playwright-tests/screenshots/search-${url.replace(/\W+/g, '-')}-${term.replace(/\W+/g, '')}.png`, fullPage: true });
  return count;
}

test('Pemasukan: cari "Gaji" menemukan transaksi Salary', async ({ page, request }) => {
  const auth = await login(request);
  await authPage(page, auth);
  const count = await searchOn(page, '/incomes', 'Gaji');
  console.log(`[incomes] "Gaji" => ${count} baris`);
  expect(count).toBeGreaterThanOrEqual(1);
});

test('Pengeluaran: cari "Tagihan" menemukan transaksi Bills', async ({ page, request }) => {
  const auth = await login(request);
  await authPage(page, auth);
  const count = await searchOn(page, '/expenses', 'Tagihan');
  console.log(`[expenses] "Tagihan" => ${count} baris`);
  expect(count).toBeGreaterThanOrEqual(1);
});

test('Transaksi: cari nominal "150.000" menemukan transaksi', async ({ page, request }) => {
  const auth = await login(request);
  await authPage(page, auth);
  const count = await searchOn(page, '/transactions', '150.000');
  console.log(`[transactions] "150.000" => ${count} baris`);
  expect(count).toBeGreaterThanOrEqual(1);
});
