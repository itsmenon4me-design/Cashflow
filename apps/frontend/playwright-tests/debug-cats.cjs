const { chromium } = require('playwright');
async function main() {
  const b = await chromium.launch(); const ctx = await b.newContext({ storageState: '/opt/data/projects/CashFlow/apps/frontend/playwright-tests/storageState.json' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/categories', { waitUntil: 'networkidle' });
  await page.waitForSelector('main');
  await page.waitForTimeout(1500);
  const cats = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('main table tbody tr')];
    return rows.map(r => {
      const cells = [...r.querySelectorAll('td')];
      const name = cells[0]?.textContent?.trim() || '';
      const status = cells[2]?.textContent?.trim() || '';
      const btns = [...r.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label'));
      return { name, status, btns };
    });
  });
  console.log(JSON.stringify(cats, null, 2));
  await b.close();
}
main().catch(e => { console.error(e); process.exit(1); });
