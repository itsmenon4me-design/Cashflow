// Firefox probe: classic space-taking scrollbars — measure filter container
// width before/after results become empty, on all 3 pages.
const { firefox } = require('@playwright/test');
const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:3001/api/v1';
const LABEL = process.argv[2] || 'run';
const SHOT = process.argv[3] === 'shots';

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

  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('cashflow.accessToken', token);
    localStorage.setItem('cashflow.refreshToken', refresh);
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'AT', email: 'admin@cashflow.local' }));
  }, { token, refresh });

  let allStable = true;
  for (const path of ['/transactions', '/incomes', '/expenses']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    const before = await page.evaluate(() => {
      const input = document.querySelector('main input[placeholder]');
      const grid = input ? input.closest('[class*="grid"]') : null;
      const main = document.querySelector('main');
      return {
        gridW: grid ? +grid.getBoundingClientRect().width.toFixed(2) : null,
        gridH: grid ? +grid.getBoundingClientRect().height.toFixed(2) : null,
        gridY: grid ? +grid.getBoundingClientRect().y.toFixed(2) : null,
        mainClientW: main.clientWidth,
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
        gridW: grid ? +grid.getBoundingClientRect().width.toFixed(2) : null,
        gridH: grid ? +grid.getBoundingClientRect().height.toFixed(2) : null,
        gridY: grid ? +grid.getBoundingClientRect().y.toFixed(2) : null,
        mainClientW: main.clientWidth,
        hasScrollbar: main.scrollHeight > main.clientHeight,
      };
    });
    const stable =
      before.gridW === after.gridW &&
      before.gridH === after.gridH &&
      before.gridY === after.gridY;
    if (!stable) allStable = false;
    console.log(`[${LABEL}] ${path}`);
    console.log(`  BEFORE: w=${before.gridW} h=${before.gridH} y=${before.gridY} mainW=${before.mainClientW} scrollbar=${before.hasScrollbar}`);
    console.log(`  AFTER : w=${after.gridW} h=${after.gridH} y=${after.gridY} mainW=${after.mainClientW} scrollbar=${after.hasScrollbar}`);
    console.log(`  => ${stable ? 'IDENTIK (0 perubahan)' : '<<< BERUBAH'}`);
    if (SHOT) {
      await page.screenshot({ path: `./playwright-traces/empty-filter-${path.slice(1)}-${LABEL}.png` });
    }
  }
  console.log(`\n[${LABEL}] RESULT: ${allStable ? 'ALL STABLE' : 'SHIFTS DETECTED'}`);
  await browser.close();
})();
