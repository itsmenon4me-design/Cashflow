const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const base = process.env.E2E_BASE_URL || 'http://localhost:3002';
  const outClient = process.env.TEMP + '/settings-client-render.html';
  console.log('Base:', base);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' });
  // Wait for client hydration flag or short timeout
  try {
    await page.waitForFunction(() => window.__app_client_ready === true, { timeout: 3000 });
  } catch (e) {
    // ignore
  }
  const content = await page.content();
  fs.writeFileSync(outClient, content, 'utf8');
  console.log('Saved client HTML to', outClient);
  await browser.close();
})();
