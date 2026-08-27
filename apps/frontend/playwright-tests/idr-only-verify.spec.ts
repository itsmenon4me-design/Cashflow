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
    localStorage.removeItem('cashflow-dashboard-currency');
  }, auth);
}

test('Header tanpa dropdown currency', async ({ page, request }) => {
  const auth = await login(request);
  await authPage(page, auth);
  await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('header', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const selects = page.locator('header [role="combobox"]');
  const count = await selects.count();
  console.log(`Combobox di header: ${count}`);
  expect(count).toBe(0);
  await page.screenshot({ path: 'playwright-tests/screenshots/idr-header.png', fullPage: false });
});

test('Settings tanpa section currency', async ({ page, request }) => {
  const auth = await login(request);
  await authPage(page, auth);
  await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const settingsSelect = page.locator('#settings-currency');
  expect(await settingsSelect.count()).toBe(0);
  await page.screenshot({ path: 'playwright-tests/screenshots/idr-settings.png', fullPage: true });
});

test('Form nominal: ketik 1000000 tampil 1.000.000', async ({ page, request }) => {
  const auth = await login(request);
  await authPage(page, auth);
  await page.goto(BASE + '/budgets', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: /tambah anggaran|tambah budget|add budget|add anggaran/i }).first().click();
  await page.waitForTimeout(1000);

  const input = page.locator('#budget-amount');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.click();
  await input.pressSequentially('1000000', { delay: 30 });
  await page.waitForTimeout(400);

  const val = await input.inputValue();
  console.log(`Input value after typing "1000000": "${val}"`);
  expect(val.replace(/[^\d]/g, '')).toBe('1000000');
  expect(val).toContain('1.000.000');
  await page.screenshot({ path: 'playwright-tests/screenshots/idr-form-amount.png' });
});

test('Search "Gaji" di Pemasukan menemukan data', async ({ page, request }) => {
  const auth = await login(request);
  await authPage(page, auth);
  await page.goto(BASE + '/incomes', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-transaction-id]', { timeout: 20000 });
  const searchInput = page.locator('input[placeholder*="kategori"]').first();
  await searchInput.fill('Gaji');
  await page.waitForTimeout(2500);
  const count = await page.locator('[data-transaction-id]').count();
  console.log(`[incomes] "Gaji" => ${count}`);
  expect(count).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: 'playwright-tests/screenshots/idr-incomes-gaji.png', fullPage: true });
});

test('Semua halaman hanya tampil Rp', async ({ page, request }) => {
  const auth = await login(request);
  await authPage(page, auth);

  for (const p of ['/transactions', '/incomes', '/expenses', '/budgets', '/saving-goals', '/investments']) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const visibleText = await page.locator('body').innerText();
    for (const sym of ['US$', 'S$', '€', '£', '¥', '₫', '₱', '฿']) {
      expect(visibleText, `[${p}] mengandung simbol asing: ${sym}`).not.toContain(sym);
    }
    await page.screenshot({ path: `playwright-tests/screenshots/idr-page-${p.replace(/\W+/g, '-')}.png`, fullPage: false });
  }
  console.log('Semua halaman lulus scan simbol asing');
});
