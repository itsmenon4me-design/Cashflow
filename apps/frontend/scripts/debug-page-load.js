const { chromium } = require('@playwright/test');

(async () => {
  const base = 'http://localhost:3000';
  const targets = ['/dashboard', '/reports'];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];
  const requests = [];
  const responses = [];
  const failed = [];

  page.on('console', (msg) => {
    try { consoleLogs.push({ type: msg.type(), text: msg.text() }); } catch (e) {}
  });
  page.on('pageerror', (err) => { pageErrors.push(String(err && err.stack ? err.stack : err)); });

  page.on('request', (req) => {
    try { req._startTime = Date.now(); requests.push({ url: req.url(), method: req.method(), rtype: req.resourceType(), start: req._startTime }); } catch(e) {}
  });
  page.on('response', async (res) => {
    try {
      const req = res.request();
      const start = req._startTime || Date.now();
      const duration = Date.now() - start;
      responses.push({ url: req.url(), status: res.status(), method: req.method(), rtype: req.resourceType(), duration });
    } catch (e) {}
  });
  page.on('requestfailed', (req) => {
    try { const start = req._startTime || Date.now(); failed.push({ url: req.url(), method: req.method(), rtype: req.resourceType(), error: req.failure()?.errorText, duration: Date.now() - start }); } catch(e) {}
  });

  const results = [];

  for (const t of targets) {
    console.log('--- Visiting', t);
    await page.goto(base + t, { waitUntil: 'domcontentloaded' });
    // give initial micro-delay for client scripts
    await page.waitForTimeout(200);

    const start = Date.now();
    let h1 = '';
    let visible = false;
    const maxAttempts = 80; // ~8s
    for (let i = 0; i < maxAttempts; i++) {
      try {
        h1 = (await page.evaluate(() => document.querySelector('h1')?.innerText || '')).trim();
      } catch (e) { h1 = ''; }
      if (h1 && h1.length > 0) { visible = true; break; }
      await page.waitForTimeout(100);
    }
    const elapsed = Date.now() - start;

    // collect slow XHR/fetch
    const slow = responses.filter(r => (r.rtype === 'xhr' || r.rtype === 'fetch') && r.duration > 300).sort((a,b)=>b.duration-a.duration).slice(0,10);

    // resource timing
    let perfEntries = [];
    try { perfEntries = await page.evaluate(() => performance.getEntriesByType('resource').map(e => ({ name: e.name, initiatorType: e.initiatorType, duration: e.duration }))); } catch(e) { perfEntries = []; }

    // check for visible skeletons or loading indicators
    const skeletonCount = await page.evaluate(() => document.querySelectorAll('.skeleton, .loading, [data-loading="true"]').length);

    results.push({ page: t, h1, visible, elapsed, slowRequests: slow, perfResources: perfEntries.slice(0,20), skeletonCount, consoleLogs: consoleLogs.slice(-20), pageErrors: pageErrors.slice(-10) });

    // clear per-page logs to focus on next target
    consoleLogs.length = 0;
    pageErrors.length = 0;
    // keep responses (global)
  }

  console.log('DEBUG_RESULTS', JSON.stringify(results, null, 2));
  await browser.close();
})();