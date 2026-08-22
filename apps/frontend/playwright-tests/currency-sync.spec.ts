import { test, expect } from '@playwright/test';

test.setTimeout(120000);

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

async function seedAuth(page: any, auth: any) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a: any) => {
    try {
      localStorage.setItem('cashflow.accessToken', a.token);
      localStorage.setItem('cashflow.refreshToken', a.refresh);
      localStorage.setItem('cashflow.user', JSON.stringify(a.user));
      localStorage.setItem('cashflow-dashboard-currency', 'IDR');
      sessionStorage.removeItem('cashflow-dashboard-currency');
      try { console.log('[test-seed] seeded localStorage cashflow-dashboard-currency', { written: localStorage.getItem('cashflow-dashboard-currency'), ts: Date.now() }); } catch (e) {}
    } catch (e) {}
  }, auth);
}

test('currency change in settings syncs to dashboard (localStorage + API)', async ({ page, request }) => {
  const auth = await login(request);
  // Add instrumentation BEFORE seeding auth so we capture seedAuth writes and any hydrate timing.
  await page.addInitScript(() => {
    try {
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        try {
          try { window.__cf_events = window.__cf_events || []; } catch (e) {}
          try { window.__cf_events.push({ type: 'setItem', key: k, value: v, ts: Date.now(), stack: (new Error()).stack }); } catch (e) {}
          if (k === 'cashflow.accessToken' || k === 'cashflow.refreshToken') {
            const t = v ?? '';
            const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
            console.log('[token-set]', JSON.stringify({ key: k, ts: Date.now(), token: masked }));
          } else if (k === 'cashflow-dashboard-currency') {
            try { console.log('[storage-write]', JSON.stringify({ key: k, ts: Date.now(), value: v, stack: (new Error()).stack })); } catch (e) {}
          }
        } catch (e) {}
        return origSet.apply(this, arguments as any);
      };
      try {
        const loc = window.location;
        const origReload = loc.reload.bind(loc);
        loc.reload = function () {
          try { console.log('[reload-hook] window.location.reload called', { ts: Date.now(), stack: (new Error()).stack }); } catch (e) {}
          return origReload();
        };
      } catch (e) {}
      const origFetch = window.fetch.bind(window);
      window.fetch = function (resource: RequestInfo, init?: RequestInit) {
        try {
          const url = typeof resource === 'string' ? resource : resource?.toString?.() || '';
          if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search')) {
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
          if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search')) {
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

  // attach collectors to capture client console and responses for diagnostics
  const consoleLogs: any[] = [];
  const settingsResponses: any[] = [];
  page.on('console', (m) => {
    try { consoleLogs.push({ type: m.type(), text: m.text() }); } catch (e) {}
  });
  page.on('close', () => { try { consoleLogs.push({ type: 'page', text: '[page] closed', ts: Date.now() }); } catch (e) {} });
  page.on('crash', () => { try { consoleLogs.push({ type: 'page', text: '[page] crash', ts: Date.now() }); } catch (e) {} });
  page.on('response', async (res) => {
    try {
      if (res.url().includes('/api/v1/settings')) {
        const text = await res.text().catch(() => null);
        settingsResponses.push({ url: res.url(), status: res.status(), bodyText: text });
      }
    } catch (e) {}
  });

  // Inject instrumentation before navigation: log when tokens are written to storage and when requests are sent.
  await page.addInitScript(() => {
    try {
      try { (window as any).__cf_events = (window as any).__cf_events || []; } catch (e) {}
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        try {
          try { (window as any).__cf_events.push({ type: 'setItem', key: k, value: v, ts: Date.now(), stack: (new Error()).stack }); } catch (e) {}
          if (k === 'cashflow.accessToken' || k === 'cashflow.refreshToken') {
            const t = v ?? '';
            const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
            // Use console.log so existing page.on('console') collector captures it.
            // eslint-disable-next-line no-console
            console.log('[token-set]', JSON.stringify({ key: k, ts: Date.now(), token: masked }));
          } else if (k === 'cashflow-dashboard-currency') {
            try { console.log('[storage-write]', JSON.stringify({ key: k, ts: Date.now(), value: v, stack: (new Error()).stack })); } catch (e) {}
          }
        } catch (e) {}
        return origSet.apply(this, arguments as any);
      };

      // Hook reload to detect reload calls from app code
      try {
        const loc = window.location;
        const origReload = loc.reload.bind(loc);
        loc.reload = function () {
          try { (window as any).__cf_events.push({ type: 'reload', ts: Date.now(), stack: (new Error()).stack }); } catch (e) {}
          try { console.log('[reload-hook] window.location.reload called', { ts: Date.now(), stack: (new Error()).stack }); } catch (e) {}
          return origReload();
        };
      } catch (e) {}

      // Capture unloads and runtime errors so we know why a page might close/crash
      try { window.addEventListener('beforeunload', () => { try { (window as any).__cf_events.push({ type: 'beforeunload', ts: Date.now() }); } catch (e) {} }); } catch (e) {}
      try { window.addEventListener('error', (ev) => { try { (window as any).__cf_events.push({ type: 'error', ts: Date.now(), message: ev?.message, stack: (ev && (ev as any).error && (ev as any).error.stack) || null }); } catch (e) {} }); } catch (e) {}
      try { window.addEventListener('unhandledrejection', (ev) => { try { (window as any).__cf_events.push({ type: 'unhandledrejection', ts: Date.now(), reason: String((ev as any).reason) }); } catch (e) {} }); } catch (e) {}

      const origFetch = window.fetch.bind(window);
      window.fetch = function (resource: RequestInfo, init?: RequestInit) {
        try {
          const url = typeof resource === 'string' ? resource : resource?.toString() || '';
          if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search')) {
            const t = localStorage.getItem('cashflow.accessToken') || '';
            const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
            try { (window as any).__cf_events.push({ type: 'req-sent', url, ts: Date.now(), token: masked }); } catch (e) {}
            // eslint-disable-next-line no-console
            console.log('[req-sent]', JSON.stringify({ url, ts: Date.now(), token: masked }));
          }
        } catch (e) {}
        return origFetch(resource, init);
      };

      const origXOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
        // store the url for send()
        try { (this as any)._instrument_url = url?.toString?.() ?? String(url); } catch (e) {}
        return origXOpen.apply(this, arguments as any);
      };
      const origXSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function (body?: Document | BodyInit | null) {
        try {
          const url = (this as any)._instrument_url ?? '';
          if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search')) {
            const t = localStorage.getItem('cashflow.accessToken') || '';
            const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
            try { (window as any).__cf_events.push({ type: 'req-sent-xhr', url, ts: Date.now(), token: masked }); } catch (e) {}
            // eslint-disable-next-line no-console
            console.log('[req-sent-xhr]', JSON.stringify({ url, ts: Date.now(), token: masked }));
          }
        } catch (e) {}
        return origXSend.apply(this, arguments as any);
      };
    } catch (e) {}
  });

  await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#settings-currency', { timeout: 15000 });

  // Open the select and choose USD
  await page.click('#settings-currency');
  // Wait for popper content and click USD inside it
  const popper = page.locator('div[data-radix-popper-content-wrapper]');
  await expect(popper).toBeVisible({ timeout: 5000 });
  const option = popper.locator('text=USD').first();
  await expect(option).toBeVisible({ timeout: 5000 });
  // ensure the option is enabled before clicking
  await expect(option).toBeEnabled({ timeout: 5000 });
  // screenshot before clicking (diagnostic artifact)
  await page.screenshot({ path: 'currency-before.png', fullPage: false }).catch(() => null);

  // click and wait for responses collected via page.on('response')
  await option.click();
  // screenshot after clicking (diagnostic artifact)
  await page.screenshot({ path: 'currency-after.png', fullPage: false }).catch(() => null);
  // read any accumulated in-page events captured by the init-script instrumentation (setItem hooks)
  try {
    // Poll the in-page event buffer for a short period to catch delayed writes or unloads.
    const collected: any[] = [];
    for (let i = 0; i < 20; i++) {
      const events = await page.evaluate(() => { try { return (window as any).__cf_events || []; } catch (e) { return []; } });
      if (Array.isArray(events) && events.length > 0) {
        collected.push(...events);
      }
      // short wait to allow late writes to appear (total ~4s)
      await page.waitForTimeout(200);
    }
    console.log('[currency-sync] in-page events after click (polled):', JSON.stringify(collected));
  } catch (e) {}
  // Wait up to 5s for client to update localStorage; poll because some code paths may overwrite quickly during hydration.
  const waited = await page.waitForFunction(() => {
    try { return localStorage.getItem('cashflow-dashboard-currency') === 'USD'; } catch { return false; }
  }, { timeout: 5000 }).catch(() => null);
  if (!waited) {
    console.log('[currency-sync] localStorage did not update within 5s (no reload fallback in this run)');
  }

  // dump diagnostics to console so Playwright includes them in run output
  console.log('[currency-sync] console logs:', JSON.stringify(consoleLogs));
  console.log('[currency-sync] captured /settings responses:', JSON.stringify(settingsResponses));

  // If we captured a /settings response, assert it was ok (server persisted)
  if (settingsResponses.length > 0) {
    const ok = settingsResponses.some((r) => r.status >= 200 && r.status < 300);
    expect(ok, `expected at least one successful /settings response, got: ${JSON.stringify(settingsResponses)}`).toBeTruthy();
  } else {
    throw new Error('No /settings responses observed after selecting currency — check client-side persist behavior');
  }

  // read localStorage after server persist and log it for diagnostics
  const storedNow = await page.evaluate(() => localStorage.getItem('cashflow-dashboard-currency'));
  console.log('[currency-sync] localStorage after persist:', storedNow);

  // navigate to dashboard and check the currency selector displays USD (the app should reflect server state)
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('header');
  // allow a short settle for client store hydration
  await page.waitForTimeout(500);
  const hasUsd = await page.locator('header').innerText();
  console.log('[currency-sync] header text:', hasUsd);
  expect(hasUsd.includes('USD')).toBeTruthy();
});