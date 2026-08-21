const { chromium } = require('@playwright/test');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Inject auth tokens into localStorage for every new page so the app renders the authenticated layout (sidebar)
  await context.addInitScript(() => {
    try {
      localStorage.setItem('cashflow.accessToken', 'dev-token');
      localStorage.setItem('cashflow.refreshToken', 'dev-token');
      localStorage.setItem('cashflow.user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }));
    } catch (e) {}
  });
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE_CONSOLE', msg.type(), msg.text()));

  // Route handler: log XHR/fetch requests and only stub auth/settings endpoints.
  await page.route('**/*', (route) => {
    const req = route.request();
    const rtype = req.resourceType();
    const url = req.url();
    if (rtype === 'xhr' || rtype === 'fetch') {
      console.log('ROUTE_XHR', url);
      // Stub auth/session/refresh endpoints so the app doesn't get 401 and block client navigation.
      if (url.includes('/auth') || url.includes('/session') || url.includes('/refresh') || url.includes('/login') || url.includes('/me')) {
        // Return a response shaped so doRefresh() succeeds (data.accessToken & refreshToken),
        // and also include user information for other callers.
        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            data: { accessToken: 'dev-token', refreshToken: 'dev-token' },
            user: { name: 'Test User', email: 'test@example.com' },
            authenticated: true,
          }),
        });
      }
      // Stub settings endpoint with minimal UserSettingsDTO wrapper the frontend expects
      if (url.includes('/api/v1/settings') || url.endsWith('/settings')) {
        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            data: {
              id: 's1',
              user_id: 'u1',
              theme: 'dark',
              language: 'en',
              currency: 'USD',
              timezone: null,
              notification_preferences: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }),
        });
      }

      // Specific stubs for notifications endpoints
      if (url.includes('/notifications/unread-count')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, data: { unreadCount: 0 } }) });
      }
      if (url.includes('/notifications')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, data: [], pagination: { totalItems: 0, totalPages: 0, page: 1 } }) });
      }
      if (url.includes('/dashboard/summary')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ totalIncome: 0, totalExpense: 0, netSavings: 0, currency: 'USD' }) });
      }
      if (url.includes('/dashboard/widgets')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([ { id: 'w1', title: 'Income', value: 0 }, { id: 'w2', title: 'Expenses', value: 0 } ]) });
      }
      if (url.includes('/transactions')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 5 } }) });
      }
      if (url.includes('/accounts')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ id: 'a1', name: 'Checking', balance: 0 }]) });
      }
      if (url.includes('/categories')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ id: 'c1', name: 'General' }]) });
      }
      if (url.includes('/reports/monthly')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          month: 8,
          year: 2026,
          summary: { income: '0', expense: '0', netCashFlow: '0', transactions: 0 },
          topExpenseCategories: [],
          topIncomeCategories: [],
        }) });
      }
      if (url.includes('/reports/category-breakdown')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'income', total: '0', categories: [] }) });
      }
      if (url.includes('/reports/cashflow-trend')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'monthly', data: [] }) });
      }
      if (url.includes('/reports')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [] }) });
      }
      if (url.includes('/saving-goals')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetAmount: '0', currentAmount: '0', percentageUsed: 0, active: 0, completed: 0 }) });
      }
      if (url.includes('/investments')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overview: { totalValue: 0 } }) });
      }
      if (url.includes('/analytics/financial-health')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 50, label: 'moderate', savingRate: 5.0, expenseRatio: 30.0, incomeVsExpense: 1.2, spendingConcentration: 20.0, cashFlowPositive: true, netCashFlow: 0 }) });
      }

      // Generic analytics endpoints (overview, income, cashflow, spending, insights)
      if (url.includes('/analytics/overview') || url.includes('/analytics/income') || url.includes('/analytics/cashflow') || url.includes('/analytics/spending') || url.includes('/analytics/insights')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, data: {} }) });
      }

      // Additional common endpoints used by pages
      if (url.includes('/incomes')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [], meta: { total: 0 } }) });
      }
      if (url.includes('/expenses')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [], meta: { total: 0 } }) });
      }
      if (url.includes('/budgets')) {
        return route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [], summary: {} }) });
      }

      // Otherwise let the request go to the real backend so pages get expected data shapes
      return route.continue();
    }
    return route.continue();
  });

  // Log responses and flag any 401s so we can expand stubs if needed
  page.on('response', (resp) => {
    try {
      const req = resp.request();
      const rt = req.resourceType();
      if (rt === 'xhr' || rt === 'fetch') {
        console.log('RESP', resp.status(), resp.url());
      }
    } catch (e) {}
  });

  const pagesToCheck = [
    '/dashboard',
    '/accounts',
    '/incomes',
    '/expenses',
    '/transactions',
    '/categories',
    '/budgets',
    '/goals',
    '/investments',
    '/reports',
    '/analytics',
    '/notifications',
    '/settings',
  ];

  const base = 'http://localhost:3000';
  const results = [];

  // Ensure a logged-in session by setting tokens & user in localStorage so the sidebar renders
  await page.goto('about:blank');
  await page.evaluate(() => {
    try {
      localStorage.setItem('cashflow.accessToken', 'dev-token');
      localStorage.setItem('cashflow.refreshToken', 'dev-token');
      localStorage.setItem('cashflow.user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }));
    } catch (e) {}
  });

  // Initial load once (authenticated)
  await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  // wait for initial content
  try { await page.waitForSelector('h1', { timeout: 5000 }); } catch (e) {}
  await page.waitForTimeout(500);

  // Ensure sidebar groups are expanded where possible so links are present in DOM (helps locating anchors)
  try {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-controls^="sidebar-group-"]'));
      for (const b of buttons) {
        try {
          if (b.getAttribute('aria-expanded') === 'false') {
            b.click();
          }
        } catch (e) {}
      }
    });
    // give the UI a moment to render
    await page.waitForTimeout(120);
  } catch (e) {}


  for (const url of pagesToCheck) {
    try {
      const beforePath = await page.evaluate(() => location.pathname);
      const beforeH1 = await page.evaluate(() => (document.querySelector('h1')?.innerText || '').trim());

      // Find a sidebar link for the target page
      const linkSelector = `a[href="${url}"]`;
      const link = await page.$(linkSelector);
      if (!link) {
        // Try alternate - links without leading slash
        const altSel = `a[href=".${url}"]`;
        const alt = await page.$(altSel);
        if (alt) {
          // use alt
        }
      }

      // If link not found, attempt to find an anchor by href equality or suffix and click it via page.evaluate
      let clickSel = linkSelector;
      if (!link) {
              const startFallback = Date.now();
              const clicked = await page.evaluate((u) => {
                try {
                  const anchors = Array.from(document.querySelectorAll('a'));
                  const a = anchors.find(a => {
                    const h = a.getAttribute('href') || a.href || '';
                    if (!h) return false;
                    // match exact or suffix
                    return h === u || h.endsWith(u) || h === ('.' + u);
                  });
                  if (a) { a.click(); return true; }
                  return false;
                } catch (e) { return false; }
              }, url);
              if (clicked) {
                // wait for nav/h1 change
                const start = Date.now();
                let elapsed = null;
                const deadline = Date.now() + 5000;
                while (Date.now() < deadline) {
                  await page.waitForTimeout(25);
                  const nowPath = await page.evaluate(() => location.pathname);
                  const nowH1 = await page.evaluate(() => (document.querySelector('h1')?.innerText || '').trim());
                  if (nowPath === url || (nowH1 && nowH1 !== beforeH1)) { elapsed = Date.now() - start; break; }
                }
                results.push({ page: url, method: 'click', clickSelector: 'evaluated', navigated: elapsed !== null, elapsed });
                continue;
              }
            }

      // If we have a normal selector, click it
      const start = Date.now();
      if (clickSel) {
        // Use locator-based clicks to avoid holding element handles across navigation
        const locator = page.locator(clickSel).first();
        try {
          const count = await locator.count();
          if (count > 0) {
            // Try several click strategies until one triggers the SPA navigation
            const clickStrategies = [
              async () => {
                try { await locator.scrollIntoViewIfNeeded(); } catch (e) {}
                await locator.click({ force: true, timeout: 1000 });
              },
              async () => {
                // fallback to dispatching a click via evaluate (simple click)
                await page.evaluate((sel) => {
                  const el = document.querySelector(sel);
                  if (el) {
                    el.click();
                    return true;
                  }
                  return false;
                }, clickSel);
              },
              async () => {
                // stronger fallback: dispatch a MouseEvent with client coordinates
                await page.evaluate((sel) => {
                  const el = document.querySelector(sel);
                  if (!el) return false;
                  const rect = el.getBoundingClientRect();
                  const ev = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
                  el.dispatchEvent(ev);
                  return true;
                }, clickSel);
              },
            ];

            for (const strat of clickStrategies) {
              try {
                await strat();
                // small pause for the router to process
                await page.waitForTimeout(60);
                break;
              } catch (e) {
                // try next strategy
              }
            }
          } else {
            // fallback: try click by text
            try { await page.click(`text=${url.replace('/', '')}`, { timeout: 1000 }); } catch (e) {}
          }
        } catch (e) {
          // last-resort: try evaluate click by searching anchors
          try {
            await page.evaluate((u) => {
              try {
                const anchors = Array.from(document.querySelectorAll('a'));
                const a = anchors.find(a => {
                  const h = a.getAttribute('href') || a.href || '';
                  if (!h) return false;
                  return h === u || h.endsWith(u) || h === ('.' + u);
                });
                if (a) { a.click(); return true; }
                return false;
              } catch (e) { return false; }
            }, url);
          } catch (er) {}
        }
      }

      // After the first click attempt, allow up to 2 retry clicks if the page didn't navigate
      let elapsed = null;

      const tryRead = async () => {
        try {
          await Promise.race([
            page.waitForURL(new RegExp(url + "$"), { timeout: 2500 }).catch(() => {}),
            page.waitForSelector('h1', { timeout: 2500 }).catch(() => {}),
          ]);
        } catch (e) {}

        // Try to read location.pathname and h1 text, retrying if the execution context was destroyed during navigation
        for (let attempt = 0; attempt < 40; attempt++) {
          try {
            const nowPath = await page.evaluate(() => location.pathname);
            const nowH1 = await page.evaluate(() => (document.querySelector('h1')?.innerText || '').trim());
            if (nowPath === url || nowPath.endsWith(url) || (nowH1 && nowH1 !== beforeH1)) {
              return Date.now();
            }
            return null;
          } catch (err) {
            await page.waitForTimeout(50);
            continue;
          }
        }
        return null;
      };

      const startTime = start;
      let finish = await tryRead();
      if (!finish) {
        // Retry up to 2 more times: re-locate the link and click again
        for (let attempt = 0; attempt < 2 && !finish; attempt++) {
         await page.waitForTimeout(120);
         try {
           const locator2 = page.locator(clickSel).first();
           if ((await locator2.count()) > 0) {
             try { await locator2.scrollIntoViewIfNeeded(); } catch (e) {}
             try { await locator2.click({ force: true, timeout: 1000 }); } catch (e) {}
           } else {
             try { await page.evaluate((u) => { const a = Array.from(document.querySelectorAll('a')).find(x => (x.getAttribute('href')||x.href||'').endsWith(u)); if (a) a.click(); }, url); } catch (e) {}
           }
         } catch (e) {}
         finish = await tryRead();
       }

       // If clicking did not navigate, try client-side router event dispatch as a fallback
       if (!finish) {
         try {
           const dispatchStart = Date.now();
           await page.evaluate((u) => {
             window.dispatchEvent(new CustomEvent('cashflow:client-route', { detail: u }));
           }, url);
           // allow small time for router handling
           finish = await tryRead();
           if (finish) elapsed = finish - start;
           if (!finish) {
             // if still not navigated, also try waiting a short bit and re-read
             await page.waitForTimeout(200);
             finish = await tryRead();
             if (finish) elapsed = finish - start;
           }
         } catch (e) {}
       }
      }

      if (finish) {
        elapsed = finish - startTime;
      }

      const resultEntry = { page: url, method: 'click', clickSelector: clickSel, navigated: elapsed !== null, elapsed };
      if (!resultEntry.navigated) {
        // collect DOM/debug info for failed navigation attempts
        try {
          const debug = await page.evaluate((u) => {
            const matches = [];
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            const anchorSamples = anchors.slice(0, 50).map(a => ({ tag: a.tagName, href: a.getAttribute('href') || a.href || '', outerHTML: a.outerHTML }));
            for (const a of anchors) {
              const href = a.getAttribute('href') || a.href || '';
              if (href.endsWith(u) || href === u) {
                matches.push({ tag: a.tagName, outerHTML: a.outerHTML, href, ariaExpanded: a.getAttribute('aria-expanded') });
            }
            }
            const buttons = Array.from(document.querySelectorAll('button[aria-controls^="sidebar-group-"]')).map(b => ({ tag: b.tagName, outerHTML: b.outerHTML, ariaExpanded: b.getAttribute('aria-expanded') }));
            return { location: location.href, matches, buttons, anchorSamples };          }, url);
          resultEntry.debug = debug;
        } catch (err) {
          resultEntry.debugError = String(err);
        }
      }

      results.push(resultEntry);
    } catch (e) {
      results.push({ page: url, error: String(e && e.message ? e.message : e) });
    }

    // small delay between clicks to mimic user
    await page.waitForTimeout(200);
  }

  fs.writeFileSync('playwright_click_verify_results.json', JSON.stringify(results, null, 2));
  console.log('CLICK_VERIFY_RESULTS', JSON.stringify(results, null, 2));

  await browser.close();
})();