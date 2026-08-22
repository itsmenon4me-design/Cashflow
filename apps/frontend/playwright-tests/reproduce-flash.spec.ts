import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const routes = ['/dashboard','/transactions','/notifications','/settings','/incomes'];

test('rapid-click menu reproduction', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // login
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#email', process.env.E2E_TEST_EMAIL || '');
  await page.fill('#password', process.env.E2E_TEST_PASSWORD || '');
  await Promise.all([
    page.click("button[type='submit']"),
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => undefined),
  ]);
  await page.waitForLoadState('networkidle');

  const events: any[] = [];
  page.on('framenavigated', (f) => events.push({ type: 'framenavigated', url: f.url() }));
  page.on('load', () => events.push({ type: 'load', time: Date.now() }));
  page.on('domcontentloaded', () => events.push({ type: 'domcontentloaded', time: Date.now() }));
  page.on('console', (m) => events.push({ type: 'console', t: m.type(), text: m.text() }));
  page.on('requestfailed', (r) => events.push({ type: 'requestfailed', url: r.url(), method: r.method(), failure: r.failure()?.errorText }));

  // navigate to dashboard shell first
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  // Rapidly click routes with small delays
  for (const r of routes) {
    // prefer visible anchors
    try {
      await page.waitForSelector(`a[href='${r}']`, { state: 'visible', timeout: 3000 });
      await page.locator(`a[href='${r}']`).first().click({ timeout: 5000 });
    } catch (e) {
      try { await page.locator(`[data-route='${r}']`).first().click({ timeout: 5000 }); } catch(e) {}
    }
    // short pause to simulate quick user clicks
    await page.waitForTimeout(300);
  }

  // wait a bit to let navigation settle
  await page.waitForTimeout(1500);
  const title = await page.title();
  const url = page.url();
  await page.screenshot({ path: 'playwright-results/reproduce-flash-final.png', fullPage: true }).catch(() => {});

  console.log('EVENTS:' + JSON.stringify(events, null, 2));
  console.log('FINAL_URL:' + url);
  console.log('FINAL_TITLE:' + title);

  await ctx.close();
});