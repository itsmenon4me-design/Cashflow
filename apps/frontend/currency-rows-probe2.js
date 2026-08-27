// Definitive per-currency row check: table rows + amount-cell symbols + API response
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

  const apiSeen = [];
  page.on('response', async (res) => {
    if (res.url().includes('/api/v1/transactions?') && res.request().method() === 'GET') {
      try {
        const j = await res.json();
        apiSeen.push({ url: res.url().split('/api/v1')[1], total: j?.pagination?.totalItems });
      } catch (e) {}
    }
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

  for (const code of ['USD', 'IDR']) {
    await setCurrency(code);
    for (const path of ['/transactions', '/incomes', '/expenses']) {
      apiSeen.length = 0;
      await page.click(`aside a[href="${path}"], nav a[href="${path}"]`).catch(() => {});
      await page.waitForURL((u) => u.pathname === path, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => {
        const rows = document.querySelectorAll('main table tbody tr');
        const amountCells = [...document.querySelectorAll('main table td.text-right.font-semibold, main table td[class*="font-semibold"]')];
        const syms = new Set();
        for (const c of amountCells) {
          const t = c.innerText.trim();
          const m = t.match(/^(Rp|\$|€|S\$)/);
          if (m) syms.add(m[1]);
          else if (/^\+?[\d.,]+$/.test(t)) syms.add('plain#');
        }
        return { rows: rows.length, symbols: [...syms], sample: amountCells.slice(0, 3).map((c) => c.innerText.trim()) };
      });
      console.log(`${code} ${path.padEnd(15)} rows=${String(info.rows).padEnd(3)} symbols=[${info.symbols.join(',')}] sample=${JSON.stringify(info.sample)} api=${JSON.stringify(apiSeen.slice(0, 1))}`);
    }
  }
  await browser.close();
})();
