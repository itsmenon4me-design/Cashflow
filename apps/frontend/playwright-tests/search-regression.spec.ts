import { test, expect } from '@playwright/test';

test.setTimeout(180000);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3101/api/v1';
const USER_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const USER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

async function login(request: any) {
  const res = await request.post(API_BASE + '/auth/login', {
    data: { email: USER_EMAIL, password: USER_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const data = body?.data ?? body;
  return { token: data.accessToken, refresh: data.refreshToken, user: body?.user ?? data?.user };
}

async function seedTx(request: any, auth: any, note: string) {
  const categories = await request.get(API_BASE + '/categories', {
    headers: { Authorization: 'Bearer ' + auth.token },
  });
  const catBody = await categories.json();
  const expenseCat = (catBody?.data ?? []).find((c: any) => c.type === 'EXPENSE') ?? (catBody?.data ?? [])[0];
  expect(expenseCat).toBeTruthy();

  const accounts = await request.get(API_BASE + '/accounts?currency=IDR', {
    headers: { Authorization: 'Bearer ' + auth.token },
  });
  const accBody = await accounts.json();
  const idrAcc = (accBody?.data ?? []).find((a: any) => a.currency === 'IDR');
  expect(idrAcc).toBeTruthy();

  const tx = await request.post(API_BASE + '/transactions', {
    headers: { Authorization: 'Bearer ' + auth.token },
    data: {
      account_id: idrAcc.id,
      category_id: expenseCat.id,
      transaction_type: 'EXPENSE',
      amount_cents: 55500,
      transaction_date: '2026-08-18',
      note,
      reference_number: crypto.randomUUID(),
    },
  });
  expect(tx.ok()).toBeTruthy();
  const txBody = await tx.json();
  const txId = txBody?.data?.id;
  expect(txId).toBeTruthy();
  return txId;
}

async function seedAuth(page: any, auth: any) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a: any) => {
    try {
      localStorage.setItem('cashflow.accessToken', a.token);
      localStorage.setItem('cashflow.refreshToken', a.refresh);
      localStorage.setItem('cashflow.user', JSON.stringify(a.user));
      localStorage.setItem('cashflow-dashboard-currency', 'IDR');
      sessionStorage.removeItem('cashflow-dashboard-currency');
    } catch (e) {}
  }, auth);
}

test('search regression uses seeded data and returns matching item', async ({ page, request }) => {
  const auth = await login(request);
  const unique = 'E2E-search-' + Date.now();
  await seedTx(request, auth, `E2E search target ${unique}`);
  // instrumentation to capture token set and request send timing (masked)
  await page.addInitScript(() => {
    try {
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        try {
          if (k === 'cashflow.accessToken' || k === 'cashflow.refreshToken') {
            const t = v ?? '';
            const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
            console.log('[token-set]', JSON.stringify({ key: k, ts: Date.now(), token: masked }));
          }
        } catch (e) {}
        return origSet.apply(this, arguments as any);
      };
      const origFetch = window.fetch.bind(window);
      window.fetch = function (resource: RequestInfo, init?: RequestInit) {
        try {
          const url = typeof resource === 'string' ? resource : resource?.toString?.() || '';
          if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search') || url.includes('/api/v1/transactions')) {
            const t = localStorage.getItem('cashflow.accessToken') || '';
            const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
            console.log('[req-sent]', JSON.stringify({ url, ts: Date.now(), token: masked }));
          }
        } catch (e) {}
        return origFetch(resource, init);
      };
      const origXOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
        try { (this as any)._instrument_url = url?.toString?.() ?? String(url); } catch (e) {}
        return origXOpen.apply(this, arguments as any);
      };
      const origXSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function (body?: Document | BodyInit | null) {
        try {
          const url = (this as any)._instrument_url ?? '';
          if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search') || url.includes('/api/v1/transactions')) {
            const t = localStorage.getItem('cashflow.accessToken') || '';
            const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
            console.log('[req-sent-xhr]', JSON.stringify({ url, ts: Date.now(), token: masked }));
          }
        } catch (e) {}
        return origXSend.apply(this, arguments as any);
      };
    } catch (e) {}
  });
  await seedAuth(page, auth);
  // collect page console entries so instrumentation logs are surfaced to test output
  const consoleLogs: any[] = [];
  page.on('console', (m) => {
    try { consoleLogs.push({ type: m.type(), text: m.text() }); } catch (e) {}
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('header', { timeout: 15000 });

  const searchInput = page.locator('header input[aria-label="Global search"], header input[aria-label="Pencarian global"]').first();
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill(unique);

  // Wait for the results panel to render an item containing the seeded note
  const expectedText = `E2E search target ${unique}`;
  await page.waitForSelector(`text="${expectedText}"`, { timeout: 20000 });

  // Also press Enter and ensure navigation to /transactions?q= and API returns matching tx
  const listResponse = page.waitForResponse(
    (res) => res.url().includes('/api/v1/transactions') && res.request().method() === 'GET' && res.url().includes(encodeURIComponent(unique)),
    { timeout: 20000 },
  );

  await searchInput.press('Enter');
  await page.waitForURL(new RegExp(`transactions\\?q=${encodeURIComponent(unique)}`), { timeout: 20000 });

  const resp = await listResponse;
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  const data = body?.data ?? body;
  const found = (Array.isArray(data) ? data : data?.data ?? []).some((d: any) => (d.note ?? '').includes(unique));
  // dump collected page console logs for forensic comparison (includes token-set / req-sent entries)
  console.log('[search-regression] console logs:', JSON.stringify(consoleLogs.slice(-40)));
  expect(found, 'seeded transaction must appear in API search results').toBeTruthy();
});