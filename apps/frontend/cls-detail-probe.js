// Detailed shift sources for worst pages
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
  await page.addInitScript(() => {
    window.__entries = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__entries.push({
            value: e.value,
            sources: (e.sources || []).slice(0, 8).map((s) => {
              let n = s.node;
              if (n && n.nodeType === 3) n = n.parentElement;
              let d = 'unknown';
              try { d = n ? `${n.tagName?.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 4).join('.') : ''}` : 'x'; } catch (err) {}
              return { d, prev: s.previousRect ? [s.previousRect.y, s.previousRect.height] : null, cur: s.currentRect ? [s.currentRect.y, s.currentRect.height] : null, text: n && n.textContent ? n.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) : '' };
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

  for (const path of ['/settings', '/analytics', '/reports', '/forecast']) {
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.evaluate(() => { window.__entries = []; });
    await page.click(`aside a[href="${path}"], nav a[href="${path}"]`);
    await page.waitForURL((u) => u.pathname === path, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const entries = await page.evaluate(() => window.__entries);
    const total = entries.reduce((a, e) => a + e.value, 0);
    console.log(`\n===== ${path} total=${total.toFixed(5)} =====`);
    for (const e of entries.sort((a, b) => b.value - a.value).slice(0, 4)) {
      console.log(` shift ${e.value.toFixed(5)}`);
      for (const s of e.sources.slice(0, 3)) {
        console.log(`   ${s.d} "${s.text}" y:${s.prev ? s.prev[0] : '?'}->${s.cur ? s.cur[0] : '?'} h:${s.prev ? s.prev[1] : '?'}->${s.cur ? s.cur[1] : '?'}`);
      }
    }
  }
  await browser.close();
})();
