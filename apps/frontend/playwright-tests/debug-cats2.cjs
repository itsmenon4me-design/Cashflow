const { chromium } = require('playwright');
const TOKEN = JSON.parse(require('fs').readFileSync('/opt/data/projects/CashFlow/apps/frontend/playwright-tests/storageState.json')).origins[0].localStorage.find(x=>x.name==='cashflow.accessToken').value;
async function main() {
  const b = await chromium.launch(); const ctx = await b.newContext({ storageState: '/opt/data/projects/CashFlow/apps/frontend/playwright-tests/storageState.json' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/categories', { waitUntil: 'networkidle' });
  await page.waitForSelector('main table');
  await page.waitForTimeout(1500);
  // Cek apakah ada kolom "System" di tabel
  const headers = await page.$$eval('main table thead th', els => els.map(e => e.textContent.trim()));
  console.log('Headers:', JSON.stringify(headers));
  // Cek setiap row ada badge system atau tidak
  const rows = await page.$$eval('main table tbody tr', els => els.map(r => {
    const cells = [...r.querySelectorAll('td')];
    const badge = cells[2]?.querySelector('span[class*="badge"], span[class*=\"bg-\"]')?.textContent || '';
    return cells.map(c=>c.textContent.trim().replace(/\s+/g,' ')).join(' | ') + ' | ' + badge;
  }));
  rows.forEach((r,i)=>console.log(i+1, r));
  await b.close();
}
main().catch(e => { console.error(e); process.exit(1); });
