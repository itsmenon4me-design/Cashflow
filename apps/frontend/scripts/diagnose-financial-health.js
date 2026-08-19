const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const out = [];
  const currencies = ['IDR','USD','SGD','EUR'];
  for (const cur of currencies) {
    const browser = await chromium.launch();
    const context = await browser.newContext();

    // capture console messages
    const consoleMsgs = [];
    const page = await context.newPage();
    page.on('console', (msg) => {
      try {
        consoleMsgs.push({type: msg.type(), text: msg.text()});
      } catch(e) {}
    });

    // attempt E2E login via API to obtain tokens (try multiple common test emails)
    const API_BASE = 'http://localhost:3001/api/v1';
    const tryEmails = ['e2e.user@test.local','e2e.api.user@test.local','e2e.income2@test.local','e2e@test.local','e2e.user@test.local'];
    const E2E_PASSWORD = process.env.E2E_PASSWORD || 'TestPass123!';
    let loginSuccess = false;
    try {
      const req = await (await require('playwright')).request.newContext({ baseURL: API_BASE });
      for (const email of tryEmails) {
        try {
          const res = await req.post('/auth/login', { data: { email, password: E2E_PASSWORD } });
          if (res.status() === 200) {
            const body = await res.json();
            const access = body?.data?.accessToken;
            const refresh = body?.data?.refreshToken;
            const user = body?.user ?? null;
            if (access) {
              // set auth tokens in localStorage before page scripts run
              await context.addInitScript((tokens) => {
                try {
                  localStorage.setItem('cashflow.accessToken', tokens.access);
                  if (tokens.refresh) localStorage.setItem('cashflow.refreshToken', tokens.refresh);
                  if (tokens.user) localStorage.setItem('cashflow.user', tokens.user);
                } catch(e) {}
              }, { access, refresh, user: user ? JSON.stringify(user) : null });
              loginSuccess = true;
              break;
            }
          }
        } catch(e) {
          // ignore and try next
        }
      }
      await req.dispose();
    } catch(e) {
      // ignore any request context errors
    }

    // set the dashboard currency before any script runs
    await context.addInitScript((c) => {
      try {
        localStorage.setItem('cashflow-dashboard-currency', c);
      } catch(e) {}
    }, cur);

    // capture network response for financial-health
    let fhRequest = null;
    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (url.includes('/api/v1/analytics/financial-health')) {
          const request = response.request();
          const reqUrl = request.url();
          const status = response.status();
          let body = null;
          try { body = await response.json(); } catch(e) { body = await response.text(); }
          fhRequest = { reqUrl, status, body };
        }
      } catch(e) {
        // ignore
      }
    });

    // go to app root
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    // wait a bit for analytics to fetch and render
    await page.waitForTimeout(2000);

    // read DOM score: look for text like "/100" or numeric score in large font
    let domScore = null;
    try {
      // try to find the "/100" element
      const locator = page.locator('text=/\\d+\\/100/');
      if (await locator.count() > 0) {
        domScore = await locator.first().innerText();
      } else {
        // fallback: find bold numeric score element
        const numLocator = page.locator('p').filter({ hasText: /^\d+$/ });
        if (await numLocator.count() > 0) {
          domScore = await numLocator.first().innerText();
        }
      }
    } catch (e) {
      domScore = null;
    }

    out.push({ currency: cur, apiResponse: fhRequest, domScore, consoleMsgs });

    await browser.close();
  }

  const outputPath = './diagnose-financial-health-result.json';
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
  console.log('Wrote', outputPath);
})();