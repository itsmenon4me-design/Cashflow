# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright\phase9.spec.ts >> STEP 12G-1 PHASE 9: currency selector runtime verification
- Location: playwright\phase9.spec.ts:32:5

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('header') to be visible
    - waiting for "http://localhost:8080/login" navigation to finish...
    - navigated to "http://localhost:8080/login"

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
  6   | 
  7   | let e2eAuth: { accessToken: string; refreshToken: string; user: Record<string, unknown> } | null = null;
  8   | 
  9   | test.beforeAll(async ({ request }) => {
  10  |   const email = process.env.E2E_EMAIL ?? 'e2e.api.user@test.local';
  11  |   const password = process.env.E2E_PASSWORD ?? 'TestPass123!';
  12  |   try {
  13  |     const login = await request.post(API_BASE + '/auth/login', {
  14  |       data: { email, password },
  15  |     });
  16  |     if (login.ok()) {
  17  |       const body = await login.json();
  18  |       const data = body?.data ?? body;
  19  |       if (data?.accessToken && data?.refreshToken && data?.user) {
  20  |         e2eAuth = { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
  21  |       } else {
  22  |         console.warn('PHASE9 login response missing tokens/user; running unauthenticated');
  23  |       }
  24  |     } else {
  25  |       console.warn('PHASE9 login failed with status', login.status());
  26  |     }
  27  |   } catch (e) {
  28  |     console.warn('PHASE9 login attempt failed', e);
  29  |   }
  30  | });
  31  | 
  32  | test('STEP 12G-1 PHASE 9: currency selector runtime verification', async ({ page }) => {
  33  |   const base = process.env.BASE_URL ?? 'http://localhost:3002';
  34  | 
  35  |   // Inject a small client-side hook that records fetch/XHR requests and responses for dashboard endpoints
  36  |   await page.addInitScript(() => {
  37  |     (window as any).__cf_network = [];
  38  |     const record = (entry: any) => {
  39  |       try { (window as any).__cf_network.push(entry); } catch (e) { }
  40  |     };
  41  | 
  42  |     const origFetch = window.fetch.bind(window as any);
  43  |     window.fetch = async (...args: any[]) => {
  44  |       const res = await origFetch(...args);
  45  |       try {
  46  |         const url = (res as any).url || (args && args[0]);
  47  |         if (typeof url === 'string' && (url.includes('/dashboard/widgets') || url.includes('/dashboard/summary'))) {
  48  |           let body = null;
  49  |           try { body = await res.clone().json(); } catch (e) { body = null; }
  50  |           record({ transport: 'fetch', method: args && args[1] && args[1].method ? args[1].method : 'GET', url: url.toString(), status: res.status, body });
  51  |         }
  52  |       } catch (e) {}
  53  |       return res;
  54  |     };
  55  | 
  56  |     // XHR hook
  57  |     const OrigX = (window as any).XMLHttpRequest;
  58  |     function ProxyXHR(this: any) {
  59  |       const xhr = new OrigX();
  60  |       const origOpen = xhr.open;
  61  |       let _url = '';
  62  |       let _method = '';
  63  |       xhr.open = function (method: any, url: any) {
  64  |         _url = url;
  65  |         _method = method;
  66  |         return origOpen.apply(this, arguments as any);
  67  |       };
  68  |       xhr.addEventListener('load', function () {
  69  |         try {
  70  |           if (typeof _url === 'string' && (_url.includes('/dashboard/widgets') || _url.includes('/dashboard/summary'))) {
  71  |             let body = null;
  72  |             try { body = JSON.parse(xhr.responseText); } catch (e) { body = null; }
  73  |             record({ transport: 'xhr', method: _method || 'GET', url: _url, status: xhr.status, body });
  74  |           }
  75  |         } catch (e) {}
  76  |       });
  77  |       return xhr;
  78  |     }
  79  |     (window as any).XMLHttpRequest = ProxyXHR as any;
  80  |   });
  81  | 
  82  |   // captured will be read from the page's __cf_network after actions
  83  |   const captured: Array<any> = []; // placeholder to hold extracted entries later
  84  | 
  85  |   // seed auth tokens + user from the verified E2E login (see beforeAll)
  86  |   await page.goto(base + '/');
  87  |   await page.evaluate((auth) => {
  88  |     try {
  89  |       if (auth) {
  90  |         localStorage.setItem('cashflow.accessToken', auth.accessToken);
  91  |         localStorage.setItem('cashflow.refreshToken', auth.refreshToken);
  92  |         localStorage.setItem('cashflow.user', JSON.stringify(auth.user));
  93  |       } else {
  94  |         console.warn('PHASE9 no verified auth fixture; proceeding unauthenticated');
  95  |       }
  96  |       sessionStorage.removeItem('cashflow-dashboard-currency');
  97  |     } catch (e) {
  98  |       // ignore
  99  |     }
  100 |   }, e2eAuth);
  101 | 
  102 |   // navigate to dashboard
  103 |   await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  104 | 
  105 |   // wait for header to render
> 106 |   await page.waitForSelector('header');
      |              ^ Error: page.waitForSelector: Test timeout of 120000ms exceeded.
  107 | 
  108 |   // ensure selector is present (the visible option text should be one of currency codes)
  109 |   const selectorText = await page.locator('header').locator('text=/IDR|USD|SGD|EUR/').first().textContent().catch(() => null);
  110 |   await expect(selectorText).not.toBeNull();
  111 | 
  112 | 
  113 |   // perform checks for each currency
  114 |   const currencies = ['IDR', 'USD', 'SGD', 'EUR'];
  115 |   const results: Record<string, { status?: number; url?: string; seen: boolean; uiText?: string } | { note: string }> = {};
  116 | 
  117 |   for (const c of currencies) {
  118 |     // Set sessionStorage to simulate selected currency and reload dashboard to ensure server requests use that currency
  119 |     await page.evaluate((cur) => {
  120 |       sessionStorage.setItem('cashflow-dashboard-currency', cur);
  121 |     }, c);
  122 | 
  123 |     // reset client-side captured array
  124 |     await page.evaluate(() => { try { (window as any).__cf_network = []; } catch (e) {} });
  125 | 
  126 |     await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  127 | 
  128 |     // wait a bit for dashboard network requests to fire
  129 |     await page.waitForTimeout(1200);
  130 | 
  131 |     // read captured network events from the page
  132 |     const entries = await page.evaluate(() => { return (window as any).__cf_network || []; });
  133 | 
  134 |     // attempt to find summary and widgets entries from captured events
  135 |     let summaryResponse = null;
  136 |     let widgetsResponse = null;
  137 |     try {
  138 |       summaryResponse = await page.waitForResponse((res) => res.url().includes('/dashboard/summary') && res.request().method() === 'GET', { timeout: 3000 });
  139 |     } catch (e) {
  140 |       summaryResponse = null;
  141 |     }
  142 |     try {
  143 |       widgetsResponse = await page.waitForResponse((res) => res.url().includes('/dashboard/widgets') && res.request().method() === 'GET', { timeout: 3000 });
  144 |     } catch (e) {
  145 |       widgetsResponse = null;
  146 |     }
  147 | 
  148 |     let summaryBody = null;
  149 |     let widgetsBody = null;
  150 |     try {
  151 |       if (summaryResponse) summaryBody = await summaryResponse.json();
  152 |     } catch (e) {
  153 |       summaryBody = null;
  154 |     }
  155 |     try {
  156 |       if (widgetsResponse) widgetsBody = await widgetsResponse.json();
  157 |     } catch (e) {
  158 |       widgetsBody = null;
  159 |     }
  160 | 
  161 |     // find relevant captured entries
  162 |     const summaryEntry = entries.find((e: any) => (e.url || '').includes('/dashboard/summary')) || null;
  163 |     const widgetsEntry = entries.find((e: any) => (e.url || '').includes('/dashboard/widgets')) || null;
  164 | 
  165 |     results[c] = {
  166 |       summaryReq: summaryEntry ? { method: summaryEntry.method || summaryEntry.transport, url: summaryEntry.url, query: (new URL(summaryEntry.url, location.href).search || null) } : null,
  167 |       widgetsReq: widgetsEntry ? { method: widgetsEntry.method || widgetsEntry.transport, url: widgetsEntry.url, query: (new URL(widgetsEntry.url, location.href).search || null) } : null,
  168 |       summaryRes: summaryEntry ? { status: summaryEntry.status, body: summaryEntry.body } : null,
  169 |       widgetsRes: widgetsEntry ? { status: widgetsEntry.status, body: widgetsEntry.body } : null,
  170 |       uiText: await page.locator('header').locator(`text=${c}`).first().textContent().catch(() => null),
  171 |     } as any;
  172 | 
  173 |     await page.waitForTimeout(200);
  174 |   }
  175 | 
  176 |   // persistence check: set USD via sessionStorage then reload and inspect sessionStorage
  177 |   await page.evaluate(() => sessionStorage.setItem('cashflow-dashboard-currency', 'USD'));
  178 |   await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  179 |   await page.waitForTimeout(400);
  180 |   const persisted = await page.evaluate(() => sessionStorage.getItem('cashflow-dashboard-currency'));
  181 | 
  182 |   // navigation check: go to /accounts and ensure QuickAdd presence (heuristic)
  183 |   await page.goto(base + '/accounts');
  184 |   const quickAddPresent = (await page.locator('text=Tambah Cepat').count()) > 0 || (await page.locator('header').locator('text=Tambah').count() > 0);
  185 | 
  186 |   // print results
  187 |   console.log('PHASE9 captured entries:', JSON.stringify(captured, null, 2));
  188 |   console.log('PHASE9 per-currency results:', JSON.stringify(results, null, 2));
  189 |   console.log('PHASE9 persisted sessionStorage:', persisted);
  190 |   console.log('PHASE9 quickAddPresent on non-dashboard page:', quickAddPresent);
  191 | 
  192 |   // Basic expectations
  193 |   expect(selectorText).not.toBeNull();
  194 |   expect(typeof persisted).toBe('string');
  195 | });
  196 | 
```