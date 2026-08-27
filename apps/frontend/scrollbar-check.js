// Check scrollbar behavior: page height & widths before/after empty results
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

  await page.goto(BASE + '/transactions', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  const before = await page.evaluate(() => {
    const input = document.querySelector('main input[placeholder]');
    const grid = input ? input.closest('[class*="grid"]') : null;
    return {
      docH: document.documentElement.scrollHeight,
      viewportH: innerHeight,
      scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      htmlOverflow: getComputedStyle(document.documentElement).overflowY,
      filterGridW: grid ? +grid.getBoundingClientRect().width.toFixed(1) : null,
      clientW: document.documentElement.clientWidth,
    };
  });

  const filterInput = page.locator('main input[placeholder]').first();
  await filterInput.fill('zzz-tidak-ada-xyz-123');
  await page.waitForTimeout(1800);
  const after = await page.evaluate(() => {
    const input = document.querySelector('main input[placeholder]');
    const grid = input ? input.closest('[class*="grid"]') : null;
    return {
      docH: document.documentElement.scrollHeight,
      viewportH: innerHeight,
      filterGridW: grid ? +grid.getBoundingClientRect().width.toFixed(1) : null,
      clientW: document.documentElement.clientWidth,
    };
  });

  console.log('BEFORE:', JSON.stringify(before));
  console.log('AFTER :', JSON.stringify(after));
  console.log('page shorter than viewport after empty?', after.docH <= after.viewportH, '(before:', before.docH > before.viewportH, ')');
  console.log('scrollbar-gutter:', before.scrollbarGutter);
  await browser.close();
})();
