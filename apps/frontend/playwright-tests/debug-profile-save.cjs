// Test updateProfile fallback path: PATCH /auth/profile → 404 → PATCH /users/:id
const { chromium } = require('playwright');
async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ storageState: '/opt/data/projects/CashFlow/apps/frontend/playwright-tests/storageState.json' });
  const page = await ctx.newPage();
  // Log semua request/response API
  page.on('response', async (res) => {
    if (res.url().includes('/api/')) {
      console.log(res.status(), res.request().method(), res.url().replace('http://localhost:3001/api/v1', ''));
      if (res.url().includes('/users/') || res.url().includes('/profile')) {
        try { console.log('   body:', JSON.stringify(await res.json()).slice(0, 200)); } catch {}
      }
    }
  });
  await page.goto('http://localhost:3000/profile', { waitUntil: 'networkidle' });
  await page.waitForSelector('main');
  await page.waitForTimeout(1000);
  // Klik edit
  await page.getByRole('button', { name: /ubah|edit/i }).first().click();
  await page.waitForSelector('#profile-name');
  await page.locator('#profile-name').fill('Debug Probe ' + Date.now().toString().slice(-4));
  // Klik save
  await page.getByRole('button', { name: /simpan|save/i }).first().click();
  await page.waitForTimeout(3000);
  console.log('--- done');
  await b.close();
}
main().catch(e => { console.error(e); process.exit(1); });
