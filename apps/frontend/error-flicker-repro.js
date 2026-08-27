// Reproduce error-state flicker: log every list-request status while typing fast
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
  const login = await apiCall('POST', '/auth/login', { email: 'admin@cashflow.local', password: 'admin123' });
  const token = login.json.data.accessToken;
  const refresh = login.json.data.refreshToken;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const failed = [];
  page.on('response', (res) => {
    if (res.url().includes('/api/v1/transactions') && res.request().method() === 'GET' && !res.ok()) {
      failed.push({ status: res.status(), url: res.url().split('/api/v1')[1] });
    }
  });
  page.on('requestfailed', (req) => {
    if (req.url().includes('/api/v1/transactions')) {
      failed.push({ status: 'FAILED', url: req.url().split('/api/v1')[1], err: req.failure()?.errorText });
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 160)));

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('cashflow.accessToken', token);
    localStorage.setItem('cashflow.refreshToken', refresh);
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'AT', email: 'admin@cashflow.local' }));
  }, { token, refresh });

  for (const path of ['/transactions', '/incomes', '/expenses']) {
    failed.length = 0;
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    const input = page.locator('main input[placeholder]').first();
    await input.click();
    // fast typing with short pauses - multiple searches in quick succession
    await input.type('abc', { delay: 120 });
    await page.waitForTimeout(600);
    await input.press('Backspace');
    await page.waitForTimeout(150);
    await input.press('Backspace');
    await page.waitForTimeout(150);
    await input.type('xyz', { delay: 100 });
    await page.waitForTimeout(1200);

    // observe which state the results area is in over time
    const states = [];
    for (let i = 0; i < 8; i++) {
      const s = await page.evaluate(() => {
        const main = document.querySelector('main');
        const t = main.innerText;
        if (t.includes('Terjadi kesalahan')) return 'ERROR';
        if (t.includes('Belum ada transaksi')) return 'EMPTY';
        if (main.querySelector('[data-slot="skeleton"], .animate-pulse')) return 'SKELETON';
        return 'TABLE';
      });
      states.push(s);
      await page.waitForTimeout(150);
    }
    console.log(`${path}: states=${states.join(',')} | failedRequests=${JSON.stringify(failed)}`);
  }
  await browser.close();
})();
