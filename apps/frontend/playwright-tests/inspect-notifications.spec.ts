import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

if (!E2E_EMAIL || !E2E_PASSWORD) {
  throw new Error('Missing E2E credentials');
}

test('inspect notifications network', async ({ browser }) => {
  const authCtx = await browser.newContext();
  const authPage = await authCtx.newPage();
  await authPage.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await authPage.fill('#email', E2E_EMAIL);
  await authPage.fill('#password', E2E_PASSWORD);
  await Promise.all([
    authPage.click("button[type='submit']"),
    authPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 }).catch(() => undefined),
  ]);
  const storage = await authCtx.storageState();
  await authCtx.close();

  const ctx = await browser.newContext({ storageState: storage });
  const page = await ctx.newPage();

  const requests: any[] = [];
  page.on('request', (r) => requests.push({ type: 'request', url: r.url(), method: r.method() }));
  page.on('response', async (res) => {
    try {
      const url = res.url();
      const status = res.status();
      if (url.includes('/notifications')) {
        let body = null;
        try { body = await res.text(); } catch (e) {}
        console.log('NOTIF RESPONSE', { url, status, body: body ? body.slice(0, 200) : null });
      }
    } catch (e) {}
  });

  await page.goto(BASE + '/notifications', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await ctx.close();

  expect(true).toBe(true);
});
