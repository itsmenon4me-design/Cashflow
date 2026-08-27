// Catch the skeleton flash window during typing with empty previous results
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

  const sample = () => page.evaluate(() => {
    const main = document.querySelector('main');
    const cards = main.querySelectorAll('[data-slot="card"]');
    let el = null;
    for (const c of cards) {
      if (c.querySelector('input[placeholder]')) { el = c.nextElementSibling; }
    }
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const isSkeleton = !!el.querySelector('[data-slot="skeleton"], .animate-pulse');
    const isEmpty = (el.textContent || '').includes('Belum ada');
    return { h: +r.height.toFixed(1), skeleton: isSkeleton, empty: isEmpty };
  });

  await page.goto(BASE + '/transactions', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  const input = page.locator('main input[placeholder]').first();
  await input.click();
  await input.type('z', { delay: 10 });
  // sample rapidly through debounce(300ms) + fetch window
  const seen = [];
  for (let i = 0; i < 14; i++) {
    const s = await sample();
    seen.push(s ? `${s.h}${s.skeleton ? '(SKELETON)' : s.empty ? '(empty)' : '(table)'}` : 'null');
    await page.waitForTimeout(90);
  }
  console.log('transactions timeline:', seen.join(' -> '));
  await browser.close();
})();
