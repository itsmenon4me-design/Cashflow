// Numeric query verification: the exact crash trigger from the video
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
    if (res.url().includes('/api/v1/') && !res.ok() && res.request().method() === 'GET') {
      failed.push({ status: res.status(), url: res.url().split('/api/v1')[1].slice(0, 90) });
    }
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('cashflow.accessToken', token);
    localStorage.setItem('cashflow.refreshToken', refresh);
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'AT', email: 'admin@cashflow.local' }));
  }, { token, refresh });

  const state = () => page.evaluate(() => {
    const t = document.querySelector('main').innerText;
    if (t.includes('Terjadi kesalahan')) return 'ERROR';
    if (t.includes('Belum ada transaksi')) return 'EMPTY';
    if (document.querySelector('main [data-slot="skeleton"], main .animate-pulse')) return 'SKELETON';
    return 'TABLE';
  });

  for (const path of ['/transactions', '/incomes', '/expenses']) {
    failed.length = 0;
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    const input = page.locator('main input[placeholder]').first();
    await input.click();
    const states = [];
    for (const digits of ['7', '77', '777', '7777', '77777', '777777', '7777777', '77777777', '99999999999999999999999999', '123']) {
      await input.fill(digits);
      await page.waitForTimeout(650);
      states.push(await state());
    }
    const errorCount = states.filter((s) => s === 'ERROR').length;
    console.log(`${path}:`);
    console.log(`  states (q=7..77777777, huge, 123): ${states.join(',')}`);
    console.log(`  error states: ${errorCount} | failed requests: ${failed.length} ${failed.length ? JSON.stringify(failed) : ''} => ${errorCount === 0 && failed.length === 0 ? 'KONSISTEN EMPTY, TANPA ERROR' : '<<< MASALAH'}`);
  }
  await browser.close();
})();
