// CLS probe: click through all sidebar menus, capture layout-shift entries with sources
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:3001/api/v1';
const OUT = process.argv[2] || 'current';

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

  const login = await apiCall('POST', '/auth/login', { email: process.env.PROBE_EMAIL || 'e2e.api.user@test.local', password: process.env.PROBE_PASS || 'TestPass123!' });
  const token = login.json.data.accessToken;
  const refresh = login.json.data.refreshToken;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.addInitScript(() => {
    window.__clsTotal = 0;
    window.__clsEntries = [];
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__clsTotal += entry.value;
          const sources = (entry.sources ?? []).map((s) => {
            const node = s.node;
            let desc = 'unknown';
            try {
              if (node) {
                desc = `${node.tagName?.toLowerCase?.() ?? node.nodeName}${node.classList?.length ? '.' + [...node.classList].slice(0, 3).join('.') : ''}`;
              }
            } catch (e) {}
            return `${desc}(prev:${JSON.stringify(s.previousRect)},cur:${JSON.stringify(s.currentRect)})`;
          });
          window.__clsEntries.push({ value: +entry.value.toFixed(5), startTime: Math.round(entry.startTime), sources });
        }
      });
      po.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('cashflow.accessToken', token);
    localStorage.setItem('cashflow.refreshToken', refresh);
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'E2E Tester', email: 'e2e.api.user@test.local' }));
    localStorage.setItem('cashflow-dashboard-currency', 'IDR');
  }, { token, refresh });

  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForSelector('header', { timeout: 20000 });
  await page.waitForTimeout(1500);

  // reset CLS baseline after initial load
  await page.evaluate(() => { window.__clsTotal = 0; window.__clsEntries = []; });

  const menus = [
    ['Beranda', '/dashboard'],
    ['Akun', '/accounts'],
    ['Pemasukan', '/incomes'],
    ['Pengeluaran', '/expenses'],
    ['Transaksi', '/transactions'],
    ['Kategori', '/categories'],
    ['Anggaran', '/budgets'],
    ['Target Tabungan', '/goals'],
    ['Investasi', '/investments'],
    ['Perkiraan Keuangan', '/forecast'],
    ['Laporan', '/reports'],
    ['Analitik', '/analytics'],
    ['Notifikasi', '/notifications'],
    ['Audit Log', '/audit-log'],
    ['Pengaturan', '/settings'],
    ['Profil', '/profile'],
  ];

  console.log(`\n===== CLS PROBE [${OUT}] =====`);
  for (const [label, href] of menus) {
    await page.evaluate(() => { window.__clsTotal = 0; window.__clsEntries = []; });
    const link = page.locator(`aside a[href="${href}"], nav a[href="${href}"]`).first();
    try {
      await link.click({ timeout: 8000 });
    } catch {
      console.log(`${label}: LINK NOT CLICKABLE`);
      continue;
    }
    await page.waitForURL((u) => u.pathname === href, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const { total, entries } = await page.evaluate(() => ({ total: window.__clsTotal, entries: window.__clsEntries }));
    const flag = total > 0.02 ? '  <<< SHIFT!' : '';
    console.log(`${label.padEnd(18)} CLS=${total.toFixed(5)}${flag}`);
    for (const e of entries.slice(0, 3)) {
      console.log(`   shift ${e.value} @${e.startTime}ms <- ${e.sources.slice(0, 2).join(' | ').slice(0, 220)}`);
    }
  }

  await page.screenshot({ path: `./playwright-traces/cls-${OUT}.png` });
  await browser.close();
})();
