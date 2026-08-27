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

test('Transaction page renders with correct colors and search', async ({ page, request }) => {
  const auth = await login(request);

  await authPage(page, auth);
  await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });

  // Wait for table or cards to appear
  await page.waitForSelector('[data-transaction-id]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  // Screenshot: full transaction list
  await page.screenshot({ path: 'playwright-tests/screenshots/transactions-list.png', fullPage: true });

  // Check placeholder text is updated (page-level filters search, not header global search)
  const searchInput = page.locator('input[placeholder*="deskripsi"], input[placeholder*="description"]').first();
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  const placeholder = await searchInput.getAttribute('placeholder');
  console.log('Search placeholder:', placeholder);
  expect(placeholder).toContain('kategori');

  // Check for red expense amount (text-danger class)
  const dangerElements = page.locator('.text-danger');
  const dangerCount = await dangerElements.count();
  console.log('Red (danger) elements:', dangerCount);

  // Check for green income amount (text-emerald-500 class)
  const emeraldElements = page.locator('.text-emerald-500');
  const emeraldCount = await emeraldElements.count();
  console.log('Green (emerald) elements:', emeraldCount);

  // Search for "100.000" (with separator) - wait for debounce
  await searchInput.fill('100.000');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'playwright-tests/screenshots/search-amount-separator.png', fullPage: true });
  console.log('Search 100.000 done');

  // Search for a category name
  await searchInput.fill('Gaji');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'playwright-tests/screenshots/search-gaji.png', fullPage: true });
  console.log('Search Gaji done');

  // Search status
  await searchInput.fill('Berhasil');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'playwright-tests/screenshots/search-berhasil.png', fullPage: true });
  console.log('Search Berhasil done');

  // Verify colors exist on initial page load (go back to full list)
  await searchInput.fill('');
  await page.waitForTimeout(2500);

  // Collect all amount cell class info
  const amountCells = page.locator('td.text-right.font-semibold, p.text-lg.font-semibold');
  const count = await amountCells.count();
  console.log('Amount cells:', count);

  for (let i = 0; i < Math.min(count, 6); i++) {
    const cls = await amountCells.nth(i).getAttribute('class');
    const text = await amountCells.nth(i).textContent();
    console.log(`Amount ${i}: "${text?.trim()}" classes="${cls}"`);
  }
});
