import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const routes = ['/transactions', '/notifications'];

const outDir = path.resolve(process.cwd(), 'playwright-results-small');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

test('navigation small - transactions and notifications', async ({ browser }) => {
  const results: any[] = [];
  function attachCollectors(page: any) {
    const logs: any[] = [];
    const failed: any[] = [];
    page.on('console', (m: any) => { try { logs.push({ type: m.type(), text: m.text() }); } catch(e) {} });
    page.on('pageerror', (err: any) => logs.push({ type: 'pageerror', text: String(err) }));
    page.on('requestfailed', (req: any) => { try { failed.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText }); } catch(e) {} });
    page.on('dialog', (d: any) => { try { d.dismiss(); } catch(e) {} });
    return { logs, failed };
  }

  for (const route of routes) {
    const entry: any = { route };

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const collectors = attachCollectors(page);

    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (e) {}
    await page.waitForTimeout(1000);
    const shot = path.join(outDir, `direct-${route.replace(/\//g,'_')}.png`);
    try { await page.screenshot({ path: shot, fullPage: true }); } catch (e) {}

    entry.direct = { url: page.url(), title: await page.title(), screenshot: path.relative(process.cwd(), shot), console: collectors.logs, failedRequests: collectors.failed };

    // client nav
    try { await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) {}
    try { await page.click(`a[href='${route}']`, { timeout: 5000 }); } catch (e) { try { await page.click(`[data-route='${route}']`, { timeout: 3000 }); } catch (e2) {} }
    await page.waitForTimeout(1200);
    const shot2 = path.join(outDir, `client-${route.replace(/\//g,'_')}.png`);
    try { await page.screenshot({ path: shot2, fullPage: true }); } catch (e) {}
    entry.client = { url: page.url(), title: await page.title(), screenshot: path.relative(process.cwd(), shot2), console: collectors.logs, failedRequests: collectors.failed };

    results.push(entry);
    await ctx.close();
  }

  fs.writeFileSync(path.join(outDir, 'navigation-small.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('Saved small results');
  expect(results.length).toBe(routes.length);
});
