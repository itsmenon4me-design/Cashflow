// Verify scrollbar-gutter:stable is applied to main (the real scroll container)
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('cashflow.accessToken', 'dev-check');
    localStorage.setItem('cashflow.user', JSON.stringify({ name: 'T', email: 't@t.t' }));
  });
  await page.goto('http://localhost:3000/transactions', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main', { timeout: 15000 });
  const info = await page.evaluate(() => {
    const main = document.querySelector('main');
    const cs = getComputedStyle(main);
    return {
      mainScrollbarGutter: cs.scrollbarGutter,
      mainOverflowY: cs.overflowY,
      mainClassName: main.className.slice(0, 140),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
