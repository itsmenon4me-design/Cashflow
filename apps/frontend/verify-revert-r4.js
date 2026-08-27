// Final verification: per-currency dashboards via real UI selector + full menu CLS
const { chromium } = require('@playwright/test');
const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:3001/api/v1';

(async () => {
  const http = await import('http');
  function apiCall(method, path, body, token) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(`${API_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode, json: buf ? JSON.parse(buf) : null }));
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }
  const login = await apiCall('POST', '/auth/login', { email: 'e2e.api.user@test.local', password: 'TestPass123!' });
  const token = login.json.data.accessToken;
  const refresh = login.json.data.refreshToken;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    window.__cls = 0;
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('cashflow.accessToken', token);
    localStorage.setItem('cashflow.refreshToken', refresh);
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'E2E', email: 'e2e.api.user@test.local' }));
  }, { token, refresh });

  const setCurrency = async (code) => {
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForSelector('header [data-slot="select-trigger"]', { timeout: 15000 });
    await page.click('header [data-slot="select-trigger"]');
    await page.waitForSelector('[data-slot="select-item"]', { timeout: 10000 });
    await page.click(`[data-slot="select-item"]:has-text("${code}")`);
    await page.waitForTimeout(1500);
  };

  const rowCurrencies = async (sel) =>
    page.evaluate((s) => {
      const text = document.querySelector(s)?.innerText ?? '';
      const symbols = new Set();
      for (const m of text.matchAll(/(Rp|€|\$|S\$)/g)) symbols.add(m[1]);
      return [...symbols];
    }, sel);

  console.log('=== PER-CURRENCY DASHBOARD CHECK ===');
  for (const code of ['USD', 'IDR']) {
    await setCurrency(code);
    console.log(`\n--- currency selector = ${code} ---`);
    const checks = [
      ['/accounts', 'table'],
      ['/incomes', 'main'],
      ['/expenses', 'main'],
      ['/transactions', 'main'],
      ['/notifications', 'main ul, main [class*="list"]'],
    ];
    for (const [path, sel] of checks) {
      await page.evaluate(() => { window.__cls = 0; });
      await page.click(`aside a[href="${path}"], nav a[href="${path}"]`).catch(async () => {
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      });
      await page.waitForTimeout(1800);
      const syms = await rowCurrencies(sel);
      const cls = await page.evaluate(() => window.__cls);
      const mixed = syms.length > 1 ? '  <<< MIXED!' : '';
      console.log(`${path.padEnd(15)} symbols=[${[...syms].join(',')}] CLS=${cls.toFixed(5)}${mixed}`);
    }
  }

  console.log('\n=== FULL MENU CLS (final) ===');
  await setCurrency('IDR');
  const menus = ['/accounts', '/incomes', '/expenses', '/transactions', '/categories', '/budgets', '/goals', '/investments', '/forecast', '/reports', '/analytics', '/notifications', '/audit-log', '/settings', '/dashboard'];
  for (const path of menus) {
    await page.evaluate(() => { window.__cls = 0; });
    await page.click(`aside a[href="${path}"], nav a[href="${path}"]`).catch(() => {});
    await page.waitForURL((u) => u.pathname === path, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1800);
    const cls = await page.evaluate(() => window.__cls);
    console.log(`${path.padEnd(15)} CLS=${cls.toFixed(5)}${cls > 0.02 ? '  <<< SHIFT!' : ''}`);
  }

  await browser.close();
})();
