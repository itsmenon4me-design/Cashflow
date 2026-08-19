# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps\frontend\playwright\transactions-e2e.spec.ts >> Transactions page month-scoped filtering (E2E) >> initial render applies current-month fromDate/toDate and backend returns only current-month transactions
- Location: apps\frontend\playwright\transactions-e2e.spec.ts:127:7

# Error details

```
TimeoutError: page.waitForResponse: Timeout 10000ms exceeded while waiting for event "response"
```

# Test source

```ts
  146 |           } catch (err) {
  147 |             record({ transport: 'fetch', url, method, error: String(err), start, stack });
  148 |             throw err;
  149 |           }
  150 |           const end = Date.now();
  151 |           let body = null;
  152 |           try { body = await res.clone().json(); } catch (e) { try { body = await res.clone().text(); } catch (_) { body = null; } }
  153 |           record({ transport: 'fetch', url, method, start, end, duration: end - start, status: res.status, body, stack });
  154 |           return res;
  155 |         };
  156 | 
  157 |         // XHR hook
  158 |         const OrigX = (window as any).XMLHttpRequest;
  159 |         function ProxyXHR(this: any) {
  160 |           const xhr = new OrigX();
  161 |           const origOpen = xhr.open;
  162 |           const origSend = xhr.send;
  163 |           let _url = '';
  164 |           let _method = '';
  165 |           xhr.open = function (method: any, url: any) {
  166 |             _url = url;
  167 |             _method = method;
  168 |             return origOpen.apply(this, arguments as any);
  169 |           };
  170 |           xhr.send = function (body: any) {
  171 |             const start = Date.now();
  172 |             const stack = new Error().stack;
  173 |             this.addEventListener('load', function () {
  174 |               try {
  175 |                 let responseBody = null;
  176 |                 try { responseBody = JSON.parse(this.responseText); } catch (e) { responseBody = this.responseText; }
  177 |                 record({ transport: 'xhr', url: _url, method: _method || 'GET', status: this.status, start, end: Date.now(), duration: Date.now() - start, body: responseBody, stack });
  178 |               } catch (e) {}
  179 |             });
  180 |             try {
  181 |               return origSend.apply(this, arguments as any);
  182 |             } catch (err) {
  183 |               record({ transport: 'xhr', url: _url, method: _method || 'GET', error: String(err), start, stack });
  184 |               throw err;
  185 |             }
  186 |           };
  187 |           return xhr;
  188 |         }
  189 |         (window as any).XMLHttpRequest = ProxyXHR as any;
  190 |       } catch (e) {
  191 |         // ignore instrumentation errors
  192 |       }
  193 |     });
  194 | 
  195 |     // Prepare UI auth to skip actual login flow (local dev only)
  196 |     await page.goto(BASE + '/');
  197 |     await page.evaluate(() => {
  198 |       try {
  199 |         localStorage.setItem('cashflow.accessToken', 'e2e-dummy-token');
  200 |         localStorage.setItem('cashflow.refreshToken', 'e2e-dummy-refresh');
  201 |         localStorage.setItem('cashflow.user', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', name: 'E2E User', email: 'e2e@test.local' }));
  202 |         sessionStorage.removeItem('cashflow-dashboard-currency');
  203 |       } catch (e) {}
  204 |     });
  205 | 
  206 |     // compute expected fromDate and toDate strings (YYYY-MM-DD)
  207 |     const now = new Date();
  208 |     const start = new Date(now.getFullYear(), now.getMonth(), 1);
  209 |     const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  210 |     const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  211 |     const expectedFrom = fmt(start);
  212 |     const expectedTo = fmt(end);
  213 | 
  214 |     // Attach request/response capture for diagnostics
  215 |     const capturedRequests: any[] = [];
  216 |     page.on('request', (r) => {
  217 |       try {
  218 |         capturedRequests.push({ type: 'request', url: r.url(), method: r.method(), headers: r.headers(), postData: r.postData() });
  219 |       } catch (e) {}
  220 |     });
  221 |     page.on('response', async (res) => {
  222 |       try {
  223 |         const url = res.url();
  224 |         let body = null;
  225 |         try { body = await res.clone().json(); } catch (e) { try { body = await res.text(); } catch (_) { body = null; } }
  226 |         capturedRequests.push({ type: 'response', url, status: res.status(), body });
  227 |       } catch (e) {}
  228 |     });
  229 | 
  230 |     // Attach a CDP session to capture requestWillBeSent with initiator info (Chromium-only)
  231 |     let cdpEvents: any[] = [];
  232 |     try {
  233 |       // @ts-ignore - playwright types allow newCDPSession
  234 |       const session = await page.context().newCDPSession(page);
  235 |       await session.send('Network.enable');
  236 |       session.on('Network.requestWillBeSent', (e: any) => {
  237 |         try {
  238 |           cdpEvents.push({ url: e.request.url, initiator: e.initiator, timestamp: Date.now(), requestId: e.requestId });
  239 |         } catch (err) {}
  240 |       });
  241 |     } catch (e) {
  242 |       // not available in non-chromium contexts
  243 |     }
  244 | 
  245 |     // Start capturing the /transactions network response (only XHR/fetch/json responses, not the page navigation)
> 246 |     const transactionsResponse = page.waitForResponse((res) => {
      |                                       ^ TimeoutError: page.waitForResponse: Timeout 10000ms exceeded while waiting for event "response"
  247 |       try {
  248 |         const url = res.url();
  249 |         if (!url.includes('/transactions')) return false;
  250 |         const r = res.request();
  251 |         const rt = r.resourceType ? r.resourceType() : '';
  252 |         const ct = (res.headers && res.headers()['content-type']) || '';
  253 |         return rt === 'xhr' || rt === 'fetch' || ct.includes('application/json');
  254 |       } catch (e) {
  255 |         return false;
  256 |       }
  257 |     }, { timeout: 10000 });
  258 | 
  259 |     // Navigate to transactions page
  260 |     await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });
  261 | 
  262 |     // Wait for the /transactions response and inspect URL and body
  263 |     const resp = await transactionsResponse;
  264 |     const req = resp.request();
  265 |     const url = req.url();
  266 | 
  267 |     // Print captured requests for diagnostics
  268 |     try {
  269 |       console.log('PLAYWRIGHT CAPTURED_NETWORK (node):', JSON.stringify((globalThis as any).capturedRequests || capturedRequests || [], null, 2));
  270 |     } catch (e) {
  271 |       try { console.log('PLAYWRIGHT CAPTURED_NETWORK (node fallback):', capturedRequests); } catch {};
  272 |     }
  273 | 
  274 |     // Also retrieve in-browser instrumentation recorded by addInitScript (fetch/XHR with stacks)
  275 |     try {
  276 |       const inBrowser = await page.evaluate(() => (window as any).__cf_network || []);
  277 |       console.log('PLAYWRIGHT IN-BROWSER NETWORK:', JSON.stringify(inBrowser, null, 2));
  278 |     } catch (e) {
  279 |       console.log('PLAYWRIGHT IN-BROWSER NETWORK: <failed to read>');
  280 |     }
  281 | 
  282 |     // Print CDP-captured initiator events
  283 |     try {
  284 |       console.log('PLAYWRIGHT CDP EVENTS:', JSON.stringify(cdpEvents || [], null, 2));
  285 |     } catch (e) {
  286 |       console.log('PLAYWRIGHT CDP EVENTS: <failed to read>');
  287 |     }
  288 | 
  289 |     // Assert URL has fromDate and toDate query params matching the current month
  290 |     expect(url).toContain(`fromDate=${expectedFrom}`);
  291 |     expect(url).toContain(`toDate=${expectedTo}`);
  292 | 
  293 |     // Assert backend returned only current-month transactions
  294 |     const body = await resp.json().catch(() => null);
  295 |     expect(body).not.toBeNull();
  296 |     // Expect pagination.totalItems to be 1 (only the tx in current month)
  297 |     expect(body.pagination).toBeDefined();
  298 |     expect(body.pagination.totalItems).toBe(1);
  299 |     expect(Array.isArray(body.data)).toBeTruthy();
  300 |     expect(body.data.length).toBeGreaterThan(0);
  301 | 
  302 |     // UI: verify toolbar count shows 1 transaksi
  303 |     await page.waitForSelector(`text=/^\\d+ transaksi$/`, { timeout: 5000 });
  304 |     const toolbarText = await page.getByText(/^\d+ transaksi$/).first().textContent();
  305 |     expect(toolbarText).toContain('1');
  306 | 
  307 |     // UI: verify table contains the inserted transaction's date
  308 |     // The frontend formats transaction date via formatTransactionDate using the
  309 |     // browser locale/timezone; replicate it in the browser so it always matches.
  310 |     const expectedUiDate = await page.evaluate(() => {
  311 |       const sample = new Date();
  312 |       const d = new Date(sample.getFullYear(), sample.getMonth(), 15, 12, 0, 0, 0);
  313 |       const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'id-ID';
  314 |       const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  315 |       const dateFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });
  316 |       const timeFormatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
  317 |       return `${dateFormatter.format(d)} • ${timeFormatter.format(d)}`;
  318 |     });
  319 | 
  320 |     // Wait for table row date cell to contain expectedUiDate
  321 |     await page.waitForSelector(`text=${expectedUiDate}`, { timeout: 5000 });
  322 |     const dateCell = await page.locator(`text=${expectedUiDate}`).first().textContent();
  323 |     expect(dateCell).toBeTruthy();
  324 |   });
  325 | });
  326 | 
  327 | 
```