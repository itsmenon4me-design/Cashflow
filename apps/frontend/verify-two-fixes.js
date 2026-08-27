// Verify: category label search + pagination stability during search
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

  console.log('=== 1) CATEGORY SEARCH (label + internal name) ===');
  await page.goto(BASE + '/categories', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  const input = page.locator('main input[placeholder]').first();
  for (const term of ['gaji', 'Gaji', 'makan', 'Makanan', 'salary', 'pendidikan', 'zzz-tidak-ada']) {
    await input.fill(term);
    await page.waitForTimeout(600);
    const t = await page.evaluate(() => document.querySelector('main').innerText);
    const results = {
      gaji: t.includes('Gaji'),
      makanan: t.includes('Makanan'),
      pendidikan: t.includes('Pendidikan'),
      emptyAll: t.includes('Belum ada kategori') && !t.includes('Gaji') && !t.includes('Makanan') && !t.includes('Pendidikan'),
    };
    let verdict;
    if (term === 'zzz-tidak-ada') verdict = results.emptyAll ? 'OK (memang tidak ada)' : '???';
    else if (term.toLowerCase() === 'gaji' || term === 'salary') verdict = results.gaji ? 'OK' : '<<< GAGAL';
    else if (term.toLowerCase().startsWith('makan')) verdict = results.makanan ? 'OK' : '<<< GAGAL';
    else if (term === 'pendidikan') verdict = results.pendidikan ? 'OK' : '<<< GAGAL';
    console.log(`  "${term}" => ${verdict}`);
  }
  await page.screenshot({ path: './playwright-traces/category-search-gaji.png' });
  await input.fill('gaji');
  await page.waitForTimeout(600);
  await page.screenshot({ path: './playwright-traces/category-search-label.png' });

  console.log('\n=== 2) PAGINATION STABILITY DURING SEARCH (with results) ===');
  for (const path of ['/transactions', '/incomes', '/expenses']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    // sample pagination presence + results rect while typing a MATCHING query
    const filterInput = page.locator('main input[placeholder]').first();
    await filterInput.click();
    await filterInput.type('a', { delay: 80 });
    const seen = [];
    for (let i = 0; i < 12; i++) {
      const s = await page.evaluate(() => {
        const main = document.querySelector('main');
        const pag = [...main.querySelectorAll('div')].find((d) => d.textContent.includes('Baris per halaman') && d.querySelector('button, select'));
        const cards = main.querySelectorAll('[data-slot="card"]');
        let el = null;
        for (const c of cards) {
          if (c.querySelector('input[placeholder]')) { el = c.nextElementSibling; }
        }
        const r = el ? el.getBoundingClientRect() : null;
        return {
          pag: pag ? 'on' : 'off',
          h: r ? +r.height.toFixed(1) : null,
          skel: el ? !!el.querySelector('[data-slot="skeleton"], .animate-pulse') : null,
        };
      });
      seen.push(`${s.pag}/h${s.h}${s.skel ? '(SKEL)' : ''}`);
      await page.waitForTimeout(110);
    }
    const pagOffCount = seen.filter((x) => x.startsWith('off')).length;
    console.log(`  ${path}: ${seen.join(' ')}`);
    console.log(`  pagination off count: ${pagOffCount}${pagOffCount > 0 ? ' <<< BLINK' : ' (stabil)'}`);
  }
  await browser.close();
})();
