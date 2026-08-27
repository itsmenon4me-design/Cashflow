// Reproduce category search issue
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

  await page.goto(BASE + '/categories', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  const bodyText = await page.evaluate(() => document.querySelector('main').innerText);
  console.log('--- initial state contains ---');
  console.log('Gaji:', bodyText.includes('Gaji'), '| Salary:', bodyText.includes('Salary'), '| Makanan:', bodyText.includes('Makanan'), '| Food:', bodyText.includes('Food'), '| Belum ada kategori:', bodyText.includes('Belum ada kategori'));

  const input = page.locator('main input[placeholder]').first();
  const ph = await input.getAttribute('placeholder');
  console.log('search placeholder:', ph);

  for (const term of ['gaji', 'Gaji', 'salary', 'Salary', 'makan', 'Food']) {
    await input.fill(term);
    await page.waitForTimeout(800);
    const t = await page.evaluate(() => document.querySelector('main').innerText);
    const hasGaji = t.includes('Gaji'), hasSalary = t.includes('Salary'), hasMakanan = t.includes('Makanan'), hasFood = t.includes('Food');
    const empty = t.includes('Belum ada kategori');
    console.log(`search "${term}" => Gaji:${hasGaji} Salary:${hasSalary} Makanan:${hasMakanan} Food:${hasFood} emptyState:${empty}`);
  }
  await browser.close();
})();
