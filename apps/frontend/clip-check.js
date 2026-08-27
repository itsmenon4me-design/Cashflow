const { chromium } = require('@playwright/test');
const http = require('http');
(async () => {
  function apiCall(method, path, body, token) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(`http://localhost:3001/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve(buf ? JSON.parse(buf) : null));
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }
  const login = await apiCall('POST', '/auth/login', { email: 'e2e.api.user@test.local', password: 'TestPass123!' });
  const token = login.data.accessToken;
  const refresh = login.data.refreshToken;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('cashflow.accessToken', token);
    localStorage.setItem('cashflow.refreshToken', refresh);
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'T', email: 'e2e.api.user@test.local' }));
  }, { token, refresh });
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
  const input = page.locator('header input[aria-label="Pencarian global"]').first();
  await input.click();
  await input.pressSequentially('pengaturan', { delay: 40 });
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const lb = document.querySelector('[role="listbox"]');
    if (!lb) return { found: false };
    const r = lb.getBoundingClientRect();
    const header = document.querySelector('header');
    const cs = getComputedStyle(header);
    const opt = lb.querySelector('[role="option"]');
    const or = opt ? opt.getBoundingClientRect() : null;
    const cx = or ? or.x + or.width / 2 : 0;
    const cy = or ? or.y + or.height / 2 : 0;
    const hit = document.elementFromPoint(cx, cy);
    return {
      found: true,
      panelRect: { y: Math.round(r.y), h: Math.round(r.height) },
      headerOverflow: cs.overflow,
      headerH: Math.round(header.getBoundingClientRect().height),
      optionCenter: { cx: Math.round(cx), cy: Math.round(cy) },
      elementAtOptionCenter: hit ? hit.tagName + '.' + String(hit.className).slice(0, 40) : 'none',
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
