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
  const anchors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({ hrefAttr: a.getAttribute('href'), hrefProp: a.href, text: a.innerText.trim().slice(0,80), outer: a.outerHTML.slice(0,400) }));
  });
  console.log('ANCHORS_AUTH2', JSON.stringify(anchors, null, 2));
  await browser.close();
})();