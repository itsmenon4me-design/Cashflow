import { test } from '@playwright/test';

test.setTimeout(60000);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API = process.env.E2E_API_BASE || 'http://localhost:3001/api/v1';
const EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

test('Debug: di mana simbol $ muncul', async ({ page, request }) => {
  const res = await request.post(API + '/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  });
  const body = await res.json();
  const auth = { token: body.data?.accessToken ?? body.accessToken, user: body.user ?? body.data?.user };

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a: any) => {
    localStorage.setItem('cashflow.accessToken', a.token);
    localStorage.setItem('cashflow.user', JSON.stringify(a.user));
    localStorage.removeItem('cashflow-dashboard-currency');
  }, auth);

  await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const text = (await page.textContent('body')) ?? '';
  // Tampilkan konteks sekitar tiap kemunculan $
  let idx = text.indexOf('$');
  while (idx !== -1 && idx < text.length) {
    console.log(`@${idx}: ...${text.substring(Math.max(0, idx - 40), idx + 40).replace(/\s+/g, ' ')}...`);
    idx = text.indexOf('$', idx + 1);
    if (idx > 5000) break;
  }
});
