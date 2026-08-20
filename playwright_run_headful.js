const { chromium } = require('@playwright/test');
const fs = require('fs');
(async () => {
  const outDir = './playwright-traces';
  try {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    if (!fs.existsSync(outDir + '/videos')) fs.mkdirSync(outDir + '/videos');
    if (!fs.existsSync(outDir + '/screenshots')) fs.mkdirSync(outDir + '/screenshots');
  } catch(e) {}

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox','--disable-setuid-sandbox'], slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: outDir + '/videos' } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('cashflow.accessToken', 'fake-token'); localStorage.setItem('cashflow.refreshToken', 'fake-refresh'); localStorage.setItem('cashflow.user', JSON.stringify({ name: 'Playwright User', email: 'pw@example.com' })); } catch (e) {} });

  const routes = ['/', '/dashboard', '/accounts', '/incomes', '/expenses', '/transactions', '/budgets', '/goals', '/investments', '/bills', '/reports', '/analytics', '/categories', '/settings'];

  try { await page.goto('http://127.0.0.1:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 }); } catch (e) { await page.goto('http://127.0.0.1:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}); }

  await page.screenshot({ path: outDir + '/screenshots/initial_headful.png', fullPage: false });

  for (const route of routes) {
    try {
      const selector = `a[href="${route}"]`;
      const el = await page.$(selector);
      if (el) {
        await Promise.all([ page.waitForURL((u) => u.endsWith(route) || u === 'http://127.0.0.1:3000' + route, { timeout: 10000 }).catch(() => {}), el.click().catch(() => {}) ]);
      } else {
        await page.goto('http://127.0.0.1:3000' + route, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => { await page.goto('http://127.0.0.1:3000' + route, { waitUntil: 'domcontentloaded', timeout: 30000 }); });
      }
    } catch (e) { console.error('NAV_ERROR', route, e && e.message); }
    await page.waitForTimeout(700);
    const name = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
    const shotPath = `${outDir}/screenshots/${name || 'home'}_headful.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
  }

  const sequence = ['/transactions', '/accounts', '/budgets', '/goals', '/investments', '/bills', '/reports', '/analytics', '/dashboard'];
  await page.goto('http://127.0.0.1:3000/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
  for (const target of sequence) {
    const sel = `a[href="${target}"]`;
    const el = await page.$(sel);
    if (el) {
      await Promise.all([ page.waitForURL((u) => u.endsWith(target) || u === 'http://127.0.0.1:3000' + target, { timeout: 15000 }).catch(() => {}), el.click().catch(() => {}) ]);
    } else {
      await page.goto('http://127.0.0.1:3000' + target, { waitUntil: 'networkidle' }).catch(() => {});
    }
    await page.waitForTimeout(700);
    const n = target.replace(/\//g, '_').replace(/^_/, '');
    await page.screenshot({ path: `${outDir}/screenshots/seq_${n || 'home'}_headful.png` });
  }

  await context.tracing.stop({ path: outDir + '/trace_headful.zip' }).catch(() => {});
  await browser.close();
  console.log('ARTIFACTS_SAVED_HEADFUL', outDir);
})();
