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
    await page.waitForTimeout(1800);
  };

  for (const code of ['IDR', 'USD']) {
    await setCurrency(code);
    for (const [path, name] of [['/accounts', 'accounts'], ['/transactions', 'transactions'], ['/budgets', 'budgets'], ['/goals', 'goals'], ['/investments', 'investments'], ['/notifications', 'notifications']]) {
      await page.click(`aside a[href="${path}"], nav a[href="${path}"]`).catch(() => {});
      await page.waitForURL((u) => u.pathname === path, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `./playwright-traces/currency-${name}-${code}.png` });
    }
  }
  console.log('screenshots saved');
  await browser.close();
})();
