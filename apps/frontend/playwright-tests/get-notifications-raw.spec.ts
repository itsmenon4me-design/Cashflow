import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API = '/api/v1/notifications?page=1&limit=20&currency=USD';

test('get raw notifications (authenticated)', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#email', process.env.E2E_TEST_EMAIL || '');
  await page.fill('#password', process.env.E2E_TEST_PASSWORD || '');
  await Promise.all([
    page.click("button[type='submit']"),
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 }).catch(() => undefined),
  ]);
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const body = await page.evaluate((api) => {
    return fetch(api, { credentials: 'same-origin' })
      .then((r) => r.status + '\n' + JSON.stringify(Object.fromEntries(r.headers.entries()), null, 2) + '\n' + r.text())
      .catch((e) => 'FETCH_ERROR: ' + String(e));
  }, API);

  console.log('RAW_NOTIF_RESPONSE:\n' + body);
  await context.close();
});