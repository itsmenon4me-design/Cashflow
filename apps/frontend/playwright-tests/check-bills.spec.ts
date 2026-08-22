import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

if (!E2E_EMAIL || !E2E_PASSWORD) {
  throw new Error('Missing E2E credentials');
}

test('check client navigation to /bills', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // login
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#email', E2E_EMAIL);
  await page.fill('#password', E2E_PASSWORD);
  await Promise.all([
    page.click("button[type='submit']"),
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => undefined),
  ]);
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // navigate to a different page first to ensure sidebar is present
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }).catch(() => {});

  // click Bills via visible selector
  try {
    await page.waitForSelector("a[href='/bills']", { state: 'visible', timeout: 5000 });
    await page.locator("a[href='/bills']").first().click({ timeout: 10000 });
  } catch (e) {
    // fallback to data-route
    try {
      await page.waitForSelector("[data-route='/bills']", { state: 'visible', timeout: 5000 });
      await page.locator("[data-route='/bills']").first().click({ timeout: 10000 });
    } catch (e2) {}
  }

  // wait a moment and gather result
  await page.waitForTimeout(1200);
  const finalUrl = page.url();
  const screenshotPath = 'playwright-results/check-bills.png';
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

  console.log('CHECK_BILLS_RESULT', { url: finalUrl, screenshot: screenshotPath });
  await ctx.close();
});