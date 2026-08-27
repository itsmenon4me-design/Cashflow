// Prove scrollbar-induced width jump with classic (space-taking) scrollbars
const { chromium } = require('@playwright/test');
const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:3001/api/v1';
const LABEL = process.argv[2] || 'run';

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

  // force classic scrollbars (space-taking) like Windows Chrome default
  const browser = await chromium.launch({ headless: true, args: ['--disable-features=OverlayScrollbar'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 700 } });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('cashflow.accessToken', token);
    localStorage.setItem('cashflow.refreshToken', refresh);
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'AT', email: 'admin@cashflow.local' }));
  }, { token, refresh });

  for (const path of ['/transactions', '/incomes', '/expenses']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    const before = await page.evaluate(() => {
      const input = document.querySelector('main input[placeholder]');
      const grid = input ? input.closest('[class*="grid"]') : null;
      const main = document.querySelector('main');
      return {
        filterGridW: grid ? +grid.getBoundingClientRect().width.toFixed(2) : null,
        mainClientW: main.clientWidth,
        mainScrollH: main.scrollHeight,
        mainClientH: main.clientHeight,
        hasScrollbar: main.scrollHeight > main.clientHeight,
      };
    });
    const filterInput = page.locator('main input[placeholder]').first();
    await filterInput.fill('zzz-tidak-ada-xyz-123');
    await page.waitForTimeout(1800);
    const after = await page.evaluate(() => {
      const input = document.querySelector('main input[placeholder]');
      const grid = input ? input.closest('[class*="grid"]') : null;
      const main = document.querySelector('main');
      return {
        filterGridW: grid ? +grid.getBoundingClientRect().width.toFixed(2) : null,
        mainClientW: main.clientWidth,
        mainScrollH: main.scrollHeight,
        mainClientH: main.clientHeight,
        hasScrollbar: main.scrollHeight > main.clientHeight,
      };
    });
    const jump = after.filterGridW !== null && before.filterGridW !== null ? +(after.filterGridW - before.filterGridW).toFixed(2) : null;
    console.log(`[${LABEL}] ${path}`);
    console.log(`  BEFORE: gridW=${before.filterGridW} mainClientW=${before.mainClientW} scrollbar=${before.hasScrollbar}`);
    console.log(`  AFTER : gridW=${after.filterGridW} mainClientW=${after.mainClientW} scrollbar=${after.hasScrollbar}`);
    console.log(`  WIDTH JUMP: ${jump === null ? '?' : jump + 'px'} ${jump ? '  <<< SHIFT' : '(stable)'}`);
  }
  await browser.close();
})();
