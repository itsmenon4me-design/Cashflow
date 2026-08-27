// Quick-nav verification: type menu names, capture panel + navigation
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
    localStorage.setItem('cashflow-dashboard-currency', 'IDR');
  }, { token, refresh });

  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForSelector('header input[aria-label="Pencarian global"]', { timeout: 15000 });
  const input = page.locator('header input[aria-label="Pencarian global"]').first();

  const cases = [
    ['profil', '/profile'],
    ['pengaturan', '/settings'],
    ['pemasukan', '/incomes'],
    ['beranda', '/dashboard'],
    ['target', '/goals'],
    ['Perkiraan', '/forecast'],
  ];

  for (const [term, expectedPath] of cases) {
    await input.click();
    await input.fill('');
    await input.pressSequentially(term, { delay: 40 });
    await page.waitForTimeout(700);
    const listbox = page.locator('[role="listbox"]');
    const visible = await listbox.count();
    let menuText = '';
    if (visible > 0) {
      const group = listbox.locator('> div').filter({ has: page.locator('p', { hasText: 'Menu' }) }).first();
      menuText = await group.innerText().catch(() => '<no menu group>');
    }
    console.log(`\n=== ketik "${term}" ===`);
    console.log(menuText.split('\n').slice(0, 8).join(' | '));
    await page.screenshot({ path: `./playwright-traces/quicknav-${term.replace(/\s+/g, '-')}.png` });

    // press Enter -> should navigate to the top menu match
    await input.press('Enter');
    await page.waitForTimeout(1200);
    const url = page.url();
    const ok = url.includes(expectedPath);
    console.log(`Enter -> ${url}  ${ok ? 'OK' : '<<< EXPECTED ' + expectedPath}`);
  }

  await browser.close();
})();
