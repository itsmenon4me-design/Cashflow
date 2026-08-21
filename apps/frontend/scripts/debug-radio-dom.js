const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3000/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  try { await page.waitForSelector('h1', { timeout: 3000 }); } catch (e) { }
  // print radio group outerHTML
  const groupExists = await page.$('[data-slot="radio-group"]');
  if (!groupExists) {
    console.log('NO_RADIO_GROUP_FOUND');
  } else {
    const outer = await page.evaluate(() => document.querySelector('[data-slot="radio-group"]').outerHTML);
    console.log('RADIO_GROUP_OUTERHTML');
    console.log(outer);
  }
  const items = await page.$$('[data-slot="radio-group-item"]');
  console.log('ITEM_COUNT', items.length);
  for (const it of items) {
    const id = await it.getAttribute('id');
    const role = await it.getAttribute('role');
    const aria = await it.getAttribute('aria-checked');
    const ds = await it.getAttribute('data-state');
    const val = await it.getAttribute('value');
    const inner = await it.evaluate(n => n.innerHTML);
    console.log({ id, role, aria, ds, val, inner: inner.slice(0,200) });
  }
  // Also print labels
  const labels = await page.$$('label[for]');
  console.log('LABEL_COUNT', labels.length);
  for (const lb of labels) {
    const html = await lb.evaluate(n => n.outerHTML);
    console.log(html);
  }

  await browser.close();
})();