// Measure categories page results-area while typing (reference pattern)
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

  const sampler = () => page.evaluate(() => {
    const main = document.querySelector('main');
    const sections = main.querySelectorAll('section');
    // the two-panel grid section
    let el = null;
    for (const s of sections) {
      if (s.className.includes('grid') && s.querySelector('[data-slot="card"]')) { el = s; break; }
    }
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cards = [...el.querySelectorAll('[data-slot="card"]')].map((c) => +c.getBoundingClientRect().height.toFixed(1));
    return { y: +r.y.toFixed(1), h: +r.height.toFixed(1), cards };
  });

  console.log('===== /categories (reference) =====');
  await page.goto(BASE + '/categories', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('settled:', JSON.stringify(await sampler()));

  const input = page.locator('main input[placeholder]').first();
  await input.click();
  for (const ch of ['z', 'z', 'z']) {
    await input.press(ch);
    await page.waitForTimeout(120);
    console.log(`typed '${ch}' (+120ms):`, JSON.stringify(await sampler()));
    await page.waitForTimeout(500);
    console.log(`  (+620ms):`, JSON.stringify(await sampler()));
  }
  await page.waitForTimeout(1200);
  console.log('settled-empty:', JSON.stringify(await sampler()));
  await browser.close();
})();
