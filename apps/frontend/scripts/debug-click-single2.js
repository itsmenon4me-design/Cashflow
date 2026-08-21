const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('cashflow.accessToken', 'dev-token');
      localStorage.setItem('cashflow.refreshToken', 'dev-token');
      localStorage.setItem('cashflow.user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }));
    } catch (e) {}
  });
  const page = await context.newPage();
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  console.log('beforePath', await page.evaluate(() => location.pathname));
  const sel = 'a[href="/incomes"]';
  const el = await page.$(sel);
  console.log('elExists', !!el);
  if (el) {
    try {
      await el.click();
      console.log('clicked via elementHandle.click');
    } catch (e) { console.log('el.click error', String(e)); }

    // try mouse click
    try {
      const box = await el.boundingBox();
      if (box) {
        const x = box.x + box.width/2;
        const y = box.y + box.height/2;
        await page.mouse.click(x, y, { steps: 1 });
        console.log('clicked via mouse at', x, y);
      }
    } catch (e) { console.log('mouse click error', String(e)); }
  } else {
    console.log('el not found');
  }

  // wait a bit
  await page.waitForTimeout(1000);
  console.log('afterPath', await page.evaluate(() => location.pathname));
  await browser.close();
})();