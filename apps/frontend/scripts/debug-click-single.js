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
  await page.waitForTimeout(500);
  console.log('beforePath', await page.evaluate(() => location.pathname));
  const sel = 'a[href="/incomes"]';
  const el = await page.$(sel);
  console.log('elExists', !!el);
  if (el) {
    await el.click();
  } else {
    console.log('el not found');
  }
  // wait a bit
  await page.waitForTimeout(500);
  console.log('afterPath', await page.evaluate(() => location.pathname));
  await browser.close();
})();