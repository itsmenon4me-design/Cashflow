# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps\frontend\playwright-tests\currency-sync.spec.ts >> currency change in settings syncs to dashboard (localStorage + API)
- Location: apps\frontend\playwright-tests\currency-sync.spec.ts:34:5

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.setTimeout(120000);
  4   | 
  5   | const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
  6   | const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3101/api/v1';
  7   | const USER_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
  8   | const USER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';
  9   | 
  10  | async function login(request: any) {
  11  |   const res = await request.post(API_BASE + '/auth/login', {
  12  |     data: { email: USER_EMAIL, password: USER_PASSWORD },
  13  |   });
> 14  |   expect(res.ok()).toBeTruthy();
      |                    ^ Error: expect(received).toBeTruthy()
  15  |   const body = await res.json();
  16  |   const data = body?.data ?? body;
  17  |   return { token: data.accessToken, refresh: data.refreshToken, user: body?.user ?? data?.user };
  18  | }
  19  | 
  20  | async function seedAuth(page: any, auth: any) {
  21  |   await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  22  |   await page.evaluate((a: any) => {
  23  |     try {
  24  |       localStorage.setItem('cashflow.accessToken', a.token);
  25  |       localStorage.setItem('cashflow.refreshToken', a.refresh);
  26  |       localStorage.setItem('cashflow.user', JSON.stringify(a.user));
  27  |       localStorage.setItem('cashflow-dashboard-currency', 'IDR');
  28  |       sessionStorage.removeItem('cashflow-dashboard-currency');
  29  |       try { console.log('[test-seed] seeded localStorage cashflow-dashboard-currency', { written: localStorage.getItem('cashflow-dashboard-currency'), ts: Date.now() }); } catch (e) {}
  30  |     } catch (e) {}
  31  |   }, auth);
  32  | }
  33  | 
  34  | test('currency change in settings syncs to dashboard (localStorage + API)', async ({ page, request }) => {
  35  |   const auth = await login(request);
  36  |   // Add instrumentation BEFORE seeding auth so we capture seedAuth writes and any hydrate timing.
  37  |   await page.addInitScript(() => {
  38  |     try {
  39  |       const origSet = Storage.prototype.setItem;
  40  |       Storage.prototype.setItem = function (k: string, v: string) {
  41  |         try {
  42  |           try { window.__cf_events = window.__cf_events || []; } catch (e) {}
  43  |           try { window.__cf_events.push({ type: 'setItem', key: k, value: v, ts: Date.now(), stack: (new Error()).stack }); } catch (e) {}
  44  |           if (k === 'cashflow.accessToken' || k === 'cashflow.refreshToken') {
  45  |             const t = v ?? '';
  46  |             const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
  47  |             console.log('[token-set]', JSON.stringify({ key: k, ts: Date.now(), token: masked }));
  48  |           } else if (k === 'cashflow-dashboard-currency') {
  49  |             try { console.log('[storage-write]', JSON.stringify({ key: k, ts: Date.now(), value: v, stack: (new Error()).stack })); } catch (e) {}
  50  |           }
  51  |         } catch (e) {}
  52  |         return origSet.apply(this, arguments as any);
  53  |       };
  54  |       try {
  55  |         const loc = window.location;
  56  |         const origReload = loc.reload.bind(loc);
  57  |         loc.reload = function () {
  58  |           try { console.log('[reload-hook] window.location.reload called', { ts: Date.now(), stack: (new Error()).stack }); } catch (e) {}
  59  |           return origReload();
  60  |         };
  61  |       } catch (e) {}
  62  |       const origFetch = window.fetch.bind(window);
  63  |       window.fetch = function (resource: RequestInfo, init?: RequestInit) {
  64  |         try {
  65  |           const url = typeof resource === 'string' ? resource : resource?.toString?.() || '';
  66  |           if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search')) {
  67  |             const t = localStorage.getItem('cashflow.accessToken') || '';
  68  |             const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
  69  |             console.log('[req-sent]', JSON.stringify({ url, ts: Date.now(), token: masked }));
  70  |           }
  71  |         } catch (e) {}
  72  |         return origFetch(resource, init);
  73  |       };
  74  |       const origXOpen = XMLHttpRequest.prototype.open;
  75  |       XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
  76  |         try { (this as any)._instrument_url = url?.toString?.() ?? String(url); } catch (e) {}
  77  |         return origXOpen.apply(this, arguments as any);
  78  |       };
  79  |       const origXSend = XMLHttpRequest.prototype.send;
  80  |       XMLHttpRequest.prototype.send = function (body?: Document | BodyInit | null) {
  81  |         try {
  82  |           const url = (this as any)._instrument_url ?? '';
  83  |           if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search')) {
  84  |             const t = localStorage.getItem('cashflow.accessToken') || '';
  85  |             const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
  86  |             console.log('[req-sent-xhr]', JSON.stringify({ url, ts: Date.now(), token: masked }));
  87  |           }
  88  |         } catch (e) {}
  89  |         return origXSend.apply(this, arguments as any);
  90  |       };
  91  |     } catch (e) {}
  92  |   });
  93  |   await seedAuth(page, auth);
  94  | 
  95  |   // attach collectors to capture client console and responses for diagnostics
  96  |   const consoleLogs: any[] = [];
  97  |   const settingsResponses: any[] = [];
  98  |   page.on('console', (m) => {
  99  |     try { consoleLogs.push({ type: m.type(), text: m.text() }); } catch (e) {}
  100 |   });
  101 |   page.on('close', () => { try { consoleLogs.push({ type: 'page', text: '[page] closed', ts: Date.now() }); } catch (e) {} });
  102 |   page.on('crash', () => { try { consoleLogs.push({ type: 'page', text: '[page] crash', ts: Date.now() }); } catch (e) {} });
  103 |   page.on('response', async (res) => {
  104 |     try {
  105 |       if (res.url().includes('/api/v1/settings')) {
  106 |         const text = await res.text().catch(() => null);
  107 |         settingsResponses.push({ url: res.url(), status: res.status(), bodyText: text });
  108 |       }
  109 |     } catch (e) {}
  110 |   });
  111 | 
  112 |   // Inject instrumentation before navigation: log when tokens are written to storage and when requests are sent.
  113 |   await page.addInitScript(() => {
  114 |     try {
```