// Non-regression: matching search still shows TABLE; screenshots of numeric empty state
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
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('cashflow.accessToken', token);
    localStorage.setItem('cashflow.refreshToken', refresh);
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'AT', email: 'admin@cashflow.local' }));
  }, { token, refresh });

  // find a real note to search for
  const list = await apiCall('GET', '/transactions?limit=5', null, token);
  const note = (list.json.data.find((t) => t.note) || {}).note;
  console.log('searching for existing note:', note);

  await page.goto(BASE + '/transactions', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  const input = page.locator('main input[placeholder]').first();
  await input.fill(note.slice(0, 12));
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => {
    const t = document.querySelector('main').innerText;
    if (t.includes('Terjadi kesalahan')) return 'ERROR';
    if (t.includes('Belum ada transaksi')) return 'EMPTY';
    return 'TABLE';
  });
  console.log('matching search state:', st, st === 'TABLE' ? 'OK' : '<<< REGRESSION');
  await page.screenshot({ path: './playwright-traces/numeric-empty-transactions.png' });

  await input.fill('77777777');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: './playwright-traces/numeric-empty-state.png' });
  console.log('screenshots saved');
  await browser.close();
})();
