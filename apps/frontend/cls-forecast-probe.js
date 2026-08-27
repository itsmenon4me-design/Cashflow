// Focused forecast CLS variance probe
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
    localStorage.setItem('cashflow-dashboard-currency', 'IDR');
  }, { token, refresh });

  for (let i = 1; i <= 3; i++) {
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.evaluate(() => { window.__cls = 0; });
    await page.click('aside a[href="/forecast"], nav a[href="/forecast"]');
    await page.waitForURL(/forecast/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const cls = await page.evaluate(() => window.__cls);
    const h = await page.evaluate(() => {
      const card = document.querySelector('main .group.card, main [class*="card"]');
      return card ? Math.round(card.getBoundingClientRect().height) : -1;
    });
    console.log(`run ${i}: forecast CLS=${cls.toFixed(5)} first-card-h=${h}`);
  }
  await browser.close();
})();
