// Reproduce: filter container size change when results become EMPTY
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
  if (!login?.json?.data?.accessToken) {
    console.error('LOGIN FAILED:', JSON.stringify(login?.json ?? login).slice(0, 200));
    process.exit(1);
  }
  const token = login.json.data.accessToken;
  const refresh = login.json.data.refreshToken;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    window.__entries = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__entries.push({
            value: e.value,
            sources: (e.sources || []).slice(0, 6).map((s) => {
              let n = s.node;
              if (n && n.nodeType === 3) n = n.parentElement;
              let d = 'unknown';
              try {
                d = n ? `${n.tagName?.toLowerCase()}${typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).slice(0, 5).join('.') : ''}` : 'x';
              } catch (err) {}
              return { d, prev: s.previousRect ? [s.previousRect.y, s.previousRect.height] : null, cur: s.currentRect ? [s.currentRect.y, s.currentRect.height] : null, text: n && n.textContent ? n.textContent.trim().replace(/\s+/g, ' ').slice(0, 36) : '' };
            }),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('cashflow.accessToken', token);
    localStorage.setItem('cashflow.refreshToken', refresh);
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'AT', email: 'admin@cashflow.local' }));
  }, { token, refresh });

  const measure = () => page.evaluate(() => {
    const main = document.querySelector('main');
    // filter card = the Card that contains the in-page search input
    const searchInput = main.querySelector('input[placeholder]');
    let filterCard = searchInput ? searchInput.closest('[data-slot="card"], .card, [class*="card"]') : null;
    // fallback: the grid inside the card
    const filterGrid = main.querySelector('[class*="grid"][class*="gap-3"]');
    const toolbar = filterGrid ? filterGrid.closest('[data-slot="card"]')?.previousElementSibling : null;
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { y: +r.y.toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1) };
    };
    return {
      filterCard: rect(filterCard),
      filterGrid: rect(filterGrid),
      toolbar: rect(toolbar),
    };
  });

  for (const path of ['/transactions', '/incomes', '/expenses']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    const before = await measure();
    await page.evaluate(() => { window.__entries = []; });

    // type a non-matching query into the IN-PAGE filter search
    const filterInput = page.locator('main input[placeholder]').first();
    await filterInput.fill('zzz-tidak-ada-xyz-123');
    await page.waitForTimeout(1800);
    const after = await measure();
    const entries = await page.evaluate(() => window.__entries);
    const total = entries.reduce((a, e) => a + e.value, 0);

    console.log(`\n===== ${path} =====`);
    console.log('BEFORE:', JSON.stringify(before));
    console.log('AFTER :', JSON.stringify(after));
    const changed =
      (before.filterCard && after.filterCard && (before.filterCard.h !== after.filterCard.h || before.filterCard.y !== after.filterCard.y)) ||
      (before.toolbar && after.toolbar && (before.toolbar.h !== after.toolbar.h || before.toolbar.y !== after.toolbar.y));
    console.log(`CLS total during empty-transition: ${total.toFixed(5)}${changed ? '  <<< FILTER AREA CHANGED' : ''}`);
    for (const e of entries.sort((a, b) => b.value - a.value).slice(0, 3)) {
      console.log(` shift ${e.value.toFixed(5)}`);
      for (const s of e.sources.slice(0, 3)) {
        console.log(`   ${s.d} "${s.text}" y:${s.prev ? s.prev[0] : '?'}->${s.cur ? s.cur[0] : '?'} h:${s.prev ? s.prev[1] : '?'}->${s.cur ? s.cur[1] : '?'}`);
      }
    }
  }
  await browser.close();
})();
