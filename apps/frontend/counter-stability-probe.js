// Verify counter stability during search (no skeleton swap, constant height)
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

  for (const path of ['/transactions', '/incomes', '/expenses']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    const input = page.locator('main input[placeholder]').first();
    await input.click();
    const seen = [];
    // type char by char, sampling right after each keystroke (skeleton window)
    for (const ch of ['a', 'b', 'c', 'z', 'z']) {
      await input.press(ch);
      for (let i = 0; i < 6; i++) {
        const s = await page.evaluate(() => {
          const main = document.querySelector('main');
          // toolbar = flex container containing the count text or its skeleton
          const countP = [...main.querySelectorAll('p')].find((p) => /transaksi|Pemasukan|Pengeluaran/.test(p.textContent) && /\d/.test(p.textContent));
          const toolbar = countP ? countP.parentElement : null;
          const skel = toolbar ? !!toolbar.querySelector('[data-slot="skeleton"], .animate-pulse') : null;
          const h = toolbar ? +toolbar.getBoundingClientRect().height.toFixed(1) : null;
          const txt = countP ? countP.textContent.trim() : null;
          return { skel, h, txt };
        });
        seen.push(`${s.txt ?? (s.skel ? 'SKELETON' : 'null')}@h${s.h}${s.skel ? '(SKEL)' : ''}`);
        await page.waitForTimeout(70);
      }
    }
    const skeletonSeen = seen.some((x) => x.includes('SKELETON') || x.includes('null@'));
    const heights = new Set(seen.map((x) => x.split('@h')[1].replace('(SKEL)', '')));
    console.log(`${path}:`);
    console.log(`  samples: ${seen.slice(0, 10).join(' | ')}`);
    console.log(`  skeleton/null seen: ${skeletonSeen ? '<<< FLICKER' : 'tidak ada'} | heights: [${[...heights].join(',')}] => ${heights.size === 1 && !skeletonSeen ? 'STABIL' : 'BERUBAH'}`);
  }
  await browser.close();
})();
