import { test, expect } from '@playwright/test';

test.setTimeout(120000);

const API_BASE = process.env.API_BASE ?? 'http://localhost:3101/api/v1';

let e2eAuth: { accessToken: string; refreshToken: string; user: Record<string, unknown> } | null = null;

test.beforeAll(async ({ request }) => {
  const email = process.env.E2E_EMAIL ?? 'e2e.api.user@test.local';
  const password = process.env.E2E_PASSWORD ?? 'TestPass123!';
  try {
    const login = await request.post(API_BASE + '/auth/login', {
      data: { email, password },
    });
    if (login.ok()) {
      const body = await login.json();
      const data = body?.data ?? body;
      const user = body?.user ?? data?.user;
      if (data?.accessToken && data?.refreshToken && user) {
        e2eAuth = { accessToken: data.accessToken, refreshToken: data.refreshToken, user };
      } else {
        console.warn('PHASE9 login response missing tokens/user; running unauthenticated');
      }
    } else {
      console.warn('PHASE9 login failed with status', login.status());
    }
  } catch (e) {
    console.warn('PHASE9 login attempt failed', e);
  }
});

test('STEP 12G-1 PHASE 9: currency selector runtime verification', async ({ page }) => {
  const base = process.env.BASE_URL ?? 'http://localhost:3002';

  // Inject a small client-side hook that records fetch/XHR requests and responses for dashboard endpoints
  await page.addInitScript(() => {
    (window as any).__cf_network = [];
    const record = (entry: any) => {
      try { (window as any).__cf_network.push(entry); } catch (e) { }
    };

    const origFetch = window.fetch.bind(window as any);
    window.fetch = async (...args: any[]) => {
      const res = await origFetch(...args);
      try {
        const url = (res as any).url || (args && args[0]);
        if (typeof url === 'string' && (url.includes('/dashboard/widgets') || url.includes('/dashboard/summary') || (url.includes('/transactions') && url.includes('currency=')))) {
          let body = null;
          try { body = await res.clone().json(); } catch (e) { body = null; }
          record({ transport: 'fetch', method: args && args[1] && args[1].method ? args[1].method : 'GET', url: url.toString(), status: res.status, body });
        }
      } catch (e) {}
      return res;
    };

    // XHR hook
    const OrigX = (window as any).XMLHttpRequest;
    function ProxyXHR(this: any) {
      const xhr = new OrigX();
      const origOpen = xhr.open;
      let _url = '';
      let _method = '';
      xhr.open = function (method: any, url: any) {
        _url = url;
        _method = method;
        return origOpen.apply(this, arguments as any);
      };
      xhr.addEventListener('load', function () {
        try {
          if (typeof _url === 'string' && (_url.includes('/dashboard/widgets') || _url.includes('/dashboard/summary') || (_url.includes('/transactions') && _url.includes('currency=')))) {
            let body = null;
            try { body = JSON.parse(xhr.responseText); } catch (e) { body = null; }
            record({ transport: 'xhr', method: _method || 'GET', url: _url, status: xhr.status, body });
          }
        } catch (e) {}
      });
      return xhr;
    }
    (window as any).XMLHttpRequest = ProxyXHR as any;
  });

  // captured will be read from the page's __cf_network after actions
  const captured: Array<any> = []; // placeholder to hold extracted entries later

  // seed auth tokens + user from the verified E2E login (see beforeAll)
  await page.goto(base + '/');
  await page.evaluate((auth) => {
    try {
      if (auth) {
        localStorage.setItem('cashflow.accessToken', auth.accessToken);
        localStorage.setItem('cashflow.refreshToken', auth.refreshToken);
        localStorage.setItem('cashflow.user', JSON.stringify(auth.user));
      } else {
        console.warn('PHASE9 no verified auth fixture; proceeding unauthenticated');
      }
      sessionStorage.removeItem('cashflow-dashboard-currency');
      localStorage.removeItem('cashflow-dashboard-currency');
    } catch (e) {
      // ignore
    }
  }, e2eAuth);

  // navigate to dashboard
  await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });

  // wait for header to render
  await page.waitForSelector('header');

  // The header shows Quick Add on dashboard routes; the currency selector
  // lives on non-dashboard routes (approved #5/#7 design: one entry point per
  // screen). Verify the selector renders on /transactions.
  await page.goto(base + '/transactions', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('header');
  const selectorText = await page.locator('header').locator('text=/IDR|USD|SGD|EUR/').first().textContent().catch(() => null);
  await expect(selectorText).not.toBeNull();

  // perform checks for each currency
  const currencies = ['IDR', 'USD', 'SGD', 'EUR'];
  const results: Record<string, { status?: number; url?: string; seen: boolean; uiText?: string } | { note: string }> = {};

  for (const c of currencies) {
    // Set localStorage to simulate selected currency and reload dashboard to ensure server requests use that currency
    await page.evaluate((cur) => {
      localStorage.setItem('cashflow-dashboard-currency', cur);
    }, c);

    // reset client-side captured array
    await page.evaluate(() => { try { (window as any).__cf_network = []; } catch (e) {} });

    await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });

    // wait a bit for dashboard network requests to fire
    await page.waitForTimeout(1200);

    // read captured network events from the page
    const entries = await page.evaluate(() => { return (window as any).__cf_network || []; });

    // attempt to find summary and widgets entries from captured events
    let summaryResponse = null;
    let widgetsResponse = null;
    try {
      summaryResponse = await page.waitForResponse((res) => res.url().includes('/dashboard/summary') && res.request().method() === 'GET', { timeout: 3000 });
    } catch (e) {
      summaryResponse = null;
    }
    try {
      widgetsResponse = await page.waitForResponse((res) => res.url().includes('/dashboard/widgets') && res.request().method() === 'GET', { timeout: 3000 });
    } catch (e) {
      widgetsResponse = null;
    }

    let summaryBody = null;
    let widgetsBody = null;
    try {
      if (summaryResponse) summaryBody = await summaryResponse.json();
    } catch (e) {
      summaryBody = null;
    }
    try {
      if (widgetsResponse) widgetsBody = await widgetsResponse.json();
    } catch (e) {
      widgetsBody = null;
    }

    // find relevant captured entries
    const summaryEntry = entries.find((e: any) => (e.url || '').includes('/dashboard/summary')) || null;
    const widgetsEntry = entries.find((e: any) => (e.url || '').includes('/dashboard/widgets')) || null;

    // on the transactions page the header selector reflects the stored
    // currency and the list refetches with the matching currency param
    await page.goto(base + '/transactions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const txReqUrl = await page.evaluate(() => (window as any).__cf_network || [])
      .then((net: any[]) => net.find((e: any) => {
        const u = String(e.url || '');
        return u.includes('/transactions') && u.includes('currency=');
      }))
      .then((found: any) => (found ? String(found.url) : null))
      .catch(() => null);

    results[c] = {
      summaryReq: summaryEntry ? { method: summaryEntry.method || summaryEntry.transport, url: summaryEntry.url, query: (new URL(summaryEntry.url, base).search || null) } : null,
      widgetsReq: widgetsEntry ? { method: widgetsEntry.method || widgetsEntry.transport, url: widgetsEntry.url, query: (new URL(widgetsEntry.url, base).search || null) } : null,
      summaryRes: summaryEntry ? { status: summaryEntry.status, body: summaryEntry.body } : null,
      widgetsRes: widgetsEntry ? { status: widgetsEntry.status, body: widgetsEntry.body } : null,
      uiText: await page.locator('header').locator(`text=${c}`).first().textContent().catch(() => null),
      transactionsReqWithCurrency: txReqUrl,
    } as any;

    await page.waitForTimeout(200);
  }

  // persistence check: set USD via localStorage then reload and inspect localStorage
  await page.evaluate(() => localStorage.setItem('cashflow-dashboard-currency', 'USD'));
  await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const persisted = await page.evaluate(() => localStorage.getItem('cashflow-dashboard-currency'));

  // navigation check (approved #5/#7 design): /dashboard shows Quick Add,
  // /accounts does NOT (it keeps its own Add button + the currency selector)
  await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('header');
  const quickAddOnDashboard =
    (await page.locator('header').locator('text=Tambah Cepat').count()) > 0 ||
    (await page.locator('header').locator('button[aria-label="Tambah Cepat"], button[aria-label="Quick Add"]').count()) > 0;

  await page.goto(base + '/accounts', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('header');
  const quickAddOnAccounts =
    (await page.locator('header').locator('text=Tambah Cepat').count()) > 0 ||
    (await page.locator('header').locator('button[aria-label="Tambah Cepat"], button[aria-label="Quick Add"]').count()) > 0;
  const selectorOnAccounts =
    (await page.locator('header').locator('text=/IDR|USD|SGD|EUR/').first().textContent().catch(() => null)) !== null;

  // print results
  console.log('PHASE9 captured entries:', JSON.stringify(captured, null, 2));
  console.log('PHASE9 per-currency results:', JSON.stringify(results, null, 2));
  console.log('PHASE9 persisted sessionStorage:', persisted);
  console.log('PHASE9 quickAddOnDashboard:', quickAddOnDashboard);
  console.log('PHASE9 quickAddOnAccounts:', quickAddOnAccounts);
  console.log('PHASE9 selectorOnAccounts:', selectorOnAccounts);

  // Basic expectations
  expect(selectorText).not.toBeNull();
  expect(typeof persisted).toBe('string');
  // one entry point per screen: Quick Add on dashboard only; selector elsewhere
  expect(quickAddOnDashboard).toBe(true);
  expect(quickAddOnAccounts).toBe(false);
  expect(selectorOnAccounts).toBe(true);
});
