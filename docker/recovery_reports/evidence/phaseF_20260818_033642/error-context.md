# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright\phase9.spec.ts >> STEP 12G-1 PHASE 9: currency selector runtime verification
- Location: playwright\phase9.spec.ts:5:5

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('header') to be visible
    - locator resolved to visible <header class="sticky top-0 z-30 overflow-hidden border-b border-border bg-background/80 backdrop-blur-xl">…</header>

```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e4]:
    - generic [ref=f2e5]:
      - heading "CashFlow" [level=1] [ref=f2e10]
      - paragraph [ref=f2e11]: Masuk untuk mengelola keuangan Anda
    - generic [ref=f2e12]:
      - generic [ref=f2e13]:
        - generic [ref=f2e14]: Masuk
        - generic [ref=f2e15]: Gunakan email dan kata sandi akun Anda
      - generic [ref=f2e16]:
        - generic [ref=f2e17]:
          - generic [ref=f2e18]:
            - generic [ref=f2e19]: Email
            - textbox "Email" [ref=f2e20]:
              - /placeholder: nama@email.com
          - generic [ref=f2e21]:
            - generic [ref=f2e22]:
              - generic [ref=f2e23]: Kata Sandi
              - link "Lupa kata sandi?" [ref=f2e24] [cursor=pointer]:
                - /url: /forgot-password
            - generic [ref=f2e25]:
              - textbox "Kata Sandi" [ref=f2e26]:
                - /placeholder: Masukkan kata sandi
              - button "Tampilkan kata sandi" [ref=f2e27]
          - button "Masuk" [ref=f2e31]
        - generic [ref=f2e32]:
          - generic [ref=f2e33]: atau
          - button "Lanjutkan dengan Google" [ref=f2e38]
          - button "Lanjutkan dengan Apple" [ref=f2e39]
    - paragraph [ref=f2e40]:
      - text: Belum punya akun?
      - link "Daftar" [ref=f2e41] [cursor=pointer]:
        - /url: /register
  - status [ref=f2e42]:
    - generic [ref=f2e50]: Anda sedang offline.
    - generic [ref=f2e51]: Data mungkin tidak terbaru. Periksa koneksi internet Anda.
  - alert [ref=f2e52]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.setTimeout(120000);
  4   | 
  5   | test('STEP 12G-1 PHASE 9: currency selector runtime verification', async ({ page }) => {
  6   |   const base = process.env.BASE_URL ?? 'http://localhost:3002';
  7   | 
  8   |   // Inject a small client-side hook that records fetch/XHR requests and responses for dashboard endpoints
  9   |   await page.addInitScript(() => {
  10  |     (window as any).__cf_network = [];
  11  |     const record = (entry: any) => {
  12  |       try { (window as any).__cf_network.push(entry); } catch (e) { }
  13  |     };
  14  | 
  15  |     const origFetch = window.fetch.bind(window as any);
  16  |     window.fetch = async (...args: any[]) => {
  17  |       const res = await origFetch(...args);
  18  |       try {
  19  |         const url = (res as any).url || (args && args[0]);
  20  |         if (typeof url === 'string' && (url.includes('/dashboard/widgets') || url.includes('/dashboard/summary'))) {
  21  |           let body = null;
  22  |           try { body = await res.clone().json(); } catch (e) { body = null; }
  23  |           record({ transport: 'fetch', method: args && args[1] && args[1].method ? args[1].method : 'GET', url: url.toString(), status: res.status, body });
  24  |         }
  25  |       } catch (e) {}
  26  |       return res;
  27  |     };
  28  | 
  29  |     // XHR hook
  30  |     const OrigX = (window as any).XMLHttpRequest;
  31  |     function ProxyXHR(this: any) {
  32  |       const xhr = new OrigX();
  33  |       const origOpen = xhr.open;
  34  |       let _url = '';
  35  |       let _method = '';
  36  |       xhr.open = function (method: any, url: any) {
  37  |         _url = url;
  38  |         _method = method;
  39  |         return origOpen.apply(this, arguments as any);
  40  |       };
  41  |       xhr.addEventListener('load', function () {
  42  |         try {
  43  |           if (typeof _url === 'string' && (_url.includes('/dashboard/widgets') || _url.includes('/dashboard/summary'))) {
  44  |             let body = null;
  45  |             try { body = JSON.parse(xhr.responseText); } catch (e) { body = null; }
  46  |             record({ transport: 'xhr', method: _method || 'GET', url: _url, status: xhr.status, body });
  47  |           }
  48  |         } catch (e) {}
  49  |       });
  50  |       return xhr;
  51  |     }
  52  |     (window as any).XMLHttpRequest = ProxyXHR as any;
  53  |   });
  54  | 
  55  |   // captured will be read from the page's __cf_network after actions
  56  |   const captured: Array<any> = []; // placeholder to hold extracted entries later
  57  | 
  58  |   // seed auth tokens + user to avoid login flow (local dev only)
  59  |   await page.goto(base + '/');
  60  |   await page.evaluate(() => {
  61  |     try {
  62  |       localStorage.setItem('cashflow.accessToken', 'dummy-access-token');
  63  |       localStorage.setItem('cashflow.refreshToken', 'dummy-refresh-token');
  64  |       localStorage.setItem('cashflow.user', JSON.stringify({ name: 'Local Test', email: 'local@test' }));
  65  |       sessionStorage.removeItem('cashflow-dashboard-currency');
  66  |     } catch (e) {
  67  |       // ignore
  68  |     }
  69  |   });
  70  | 
  71  |   // navigate to dashboard
  72  |   await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  73  | 
  74  |   // wait for header to render
> 75  |   await page.waitForSelector('header');
      |              ^ Error: page.waitForSelector: Test timeout of 120000ms exceeded.
  76  | 
  77  |   // ensure selector is present (the visible option text should be one of currency codes)
  78  |   const selectorText = await page.locator('header').locator('text=/IDR|USD|SGD|EUR/').first().textContent().catch(() => null);
  79  |   await expect(selectorText).not.toBeNull();
  80  | 
  81  | 
  82  |   // perform checks for each currency
  83  |   const currencies = ['IDR', 'USD', 'SGD', 'EUR'];
  84  |   const results: Record<string, { status?: number; url?: string; seen: boolean; uiText?: string } | { note: string }> = {};
  85  | 
  86  |   for (const c of currencies) {
  87  |     // Set sessionStorage to simulate selected currency and reload dashboard to ensure server requests use that currency
  88  |     await page.evaluate((cur) => {
  89  |       sessionStorage.setItem('cashflow-dashboard-currency', cur);
  90  |     }, c);
  91  | 
  92  |     // reset client-side captured array
  93  |     await page.evaluate(() => { try { (window as any).__cf_network = []; } catch (e) {} });
  94  | 
  95  |     await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  96  | 
  97  |     // wait a bit for dashboard network requests to fire
  98  |     await page.waitForTimeout(1200);
  99  | 
  100 |     // read captured network events from the page
  101 |     const entries = await page.evaluate(() => { return (window as any).__cf_network || []; });
  102 | 
  103 |     // attempt to find summary and widgets entries from captured events
  104 |     let summaryResponse = null;
  105 |     let widgetsResponse = null;
  106 |     try {
  107 |       summaryResponse = await page.waitForResponse((res) => res.url().includes('/dashboard/summary') && res.request().method() === 'GET', { timeout: 3000 });
  108 |     } catch (e) {
  109 |       summaryResponse = null;
  110 |     }
  111 |     try {
  112 |       widgetsResponse = await page.waitForResponse((res) => res.url().includes('/dashboard/widgets') && res.request().method() === 'GET', { timeout: 3000 });
  113 |     } catch (e) {
  114 |       widgetsResponse = null;
  115 |     }
  116 | 
  117 |     let summaryBody = null;
  118 |     let widgetsBody = null;
  119 |     try {
  120 |       if (summaryResponse) summaryBody = await summaryResponse.json();
  121 |     } catch (e) {
  122 |       summaryBody = null;
  123 |     }
  124 |     try {
  125 |       if (widgetsResponse) widgetsBody = await widgetsResponse.json();
  126 |     } catch (e) {
  127 |       widgetsBody = null;
  128 |     }
  129 | 
  130 |     // find relevant captured entries
  131 |     const summaryEntry = entries.find((e: any) => (e.url || '').includes('/dashboard/summary')) || null;
  132 |     const widgetsEntry = entries.find((e: any) => (e.url || '').includes('/dashboard/widgets')) || null;
  133 | 
  134 |     results[c] = {
  135 |       summaryReq: summaryEntry ? { method: summaryEntry.method || summaryEntry.transport, url: summaryEntry.url, query: (new URL(summaryEntry.url, location.href).search || null) } : null,
  136 |       widgetsReq: widgetsEntry ? { method: widgetsEntry.method || widgetsEntry.transport, url: widgetsEntry.url, query: (new URL(widgetsEntry.url, location.href).search || null) } : null,
  137 |       summaryRes: summaryEntry ? { status: summaryEntry.status, body: summaryEntry.body } : null,
  138 |       widgetsRes: widgetsEntry ? { status: widgetsEntry.status, body: widgetsEntry.body } : null,
  139 |       uiText: await page.locator('header').locator(`text=${c}`).first().textContent().catch(() => null),
  140 |     } as any;
  141 | 
  142 |     await page.waitForTimeout(200);
  143 |   }
  144 | 
  145 |   // persistence check: set USD via sessionStorage then reload and inspect sessionStorage
  146 |   await page.evaluate(() => sessionStorage.setItem('cashflow-dashboard-currency', 'USD'));
  147 |   await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  148 |   await page.waitForTimeout(400);
  149 |   const persisted = await page.evaluate(() => sessionStorage.getItem('cashflow-dashboard-currency'));
  150 | 
  151 |   // navigation check: go to /accounts and ensure QuickAdd presence (heuristic)
  152 |   await page.goto(base + '/accounts');
  153 |   const quickAddPresent = (await page.locator('text=Tambah Cepat').count()) > 0 || (await page.locator('header').locator('text=Tambah').count() > 0);
  154 | 
  155 |   // print results
  156 |   console.log('PHASE9 captured entries:', JSON.stringify(captured, null, 2));
  157 |   console.log('PHASE9 per-currency results:', JSON.stringify(results, null, 2));
  158 |   console.log('PHASE9 persisted sessionStorage:', persisted);
  159 |   console.log('PHASE9 quickAddPresent on non-dashboard page:', quickAddPresent);
  160 | 
  161 |   // Basic expectations
  162 |   expect(selectorText).not.toBeNull();
  163 |   expect(typeof persisted).toBe('string');
  164 | });
  165 | 
```