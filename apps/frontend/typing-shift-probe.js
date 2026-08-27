// Measure the results-area container while typing a non-matching query
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

  // sample the results-area rect every 100ms while typing
  const sampler = () => page.evaluate(() => {
    const main = document.querySelector('main');
    // results area = the element right after the filters card
    const cards = main.querySelectorAll('[data-slot="card"]');
    let el = null;
    for (const c of cards) {
      if (c.querySelector('input[placeholder]')) { el = c.nextElementSibling; }
    }
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { y: +r.y.toFixed(1), h: +r.height.toFixed(1), tag: el.tagName, cls: String(el.className).slice(0, 60), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) };
  });

  for (const path of ['/transactions', '/incomes']) {
    console.log(`\n===== ${path} =====`);
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('settled-with-results:', JSON.stringify(await sampler()));

    const filterInput = page.locator('main input[placeholder]').first();
    await filterInput.click();
    // type char by char, sampling during the loading window after each char
    for (const ch of ['z', 'z', 'z']) {
      await filterInput.press(ch);
      await page.waitForTimeout(120);
      const s = await sampler();
      console.log(`typed '${ch}' (+120ms):`, JSON.stringify(s));
      await page.waitForTimeout(500);
      console.log(`  (+620ms):`, JSON.stringify(await sampler()));
    }
    await page.waitForTimeout(1200);
    console.log('settled-empty:', JSON.stringify(await sampler()));
  }
  await browser.close();
})();
