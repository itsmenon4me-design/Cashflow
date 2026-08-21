import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

const routes = [
  '/',
  '/accounts',
  '/incomes',
  '/expenses',
  '/transactions',
  '/budgets',
  '/goals',
  '/investments',
  '/bills',
  '/reports',
  '/analytics',
  '/dashboard',
  '/categories',
  '/notifications',
  '/settings',
];

const outDir = path.resolve(process.cwd(), 'playwright-results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

test('navigation matrix - direct URL and client navigation', async ({ browser }) => {
  const results: any[] = [];

  // helper to attach collectors to a page
  function attachCollectors(page: any) {
    const logs: any[] = [];
    const failed: any[] = [];
    page.on('console', (m: any) => {
      try { logs.push({ type: m.type(), text: m.text() }); } catch(e) {}
    });
    page.on('pageerror', (err: any) => logs.push({ type: 'pageerror', text: String(err) }));
    page.on('requestfailed', (req: any) => {
      try { failed.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText }); } catch(e) {}
    });
    page.on('dialog', (d: any) => { try { d.dismiss(); } catch(e) {} });
    return { logs, failed };
  }

  // Authenticate first using environment credentials (stop if not provided)
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    console.error('E2E_TEST_EMAIL or E2E_TEST_PASSWORD not configured. Aborting authenticated run.');
    throw new Error('Missing E2E credentials in environment variables (E2E_TEST_EMAIL / E2E_TEST_PASSWORD)');
  }

  // Perform UI login and capture authenticated storage state
  const authContext = await browser.newContext();
  const authPage = await authContext.newPage();
  try {
    await authPage.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
    await authPage.fill('#email', E2E_EMAIL);
    await authPage.fill('#password', E2E_PASSWORD);
    await Promise.all([
      authPage.click("button[type='submit']"),
      authPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 }).catch(() => undefined),
    ]);
    await authPage.waitForLoadState('networkidle');
  } catch (e) {
    console.error('UI login failed:', String(e));
    await authContext.close();
    throw e;
  }

  const storageState = await authContext.storageState();
  await authContext.close();

  for (const route of routes) {
    const entry: any = { route };

    // Direct navigation (hard load) using fresh context
    const context1 = await browser.newContext({ storageState });
    const page1 = await context1.newPage();
    const directCollectors = attachCollectors(page1);
    try {
      await page1.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (e) {
      // ignore navigation errors but continue collecting artifacts
    }
    await page1.waitForTimeout(1000);
    const directPath = path.join(outDir, `direct-${route === '/' ? 'root' : route.replace(/\//g, '_')}.png`);
    try { await page1.screenshot({ path: directPath, fullPage: true }); } catch (e) {}
    entry.direct = {
      url: page1.url(),
      title: await page1.title(),
      screenshot: path.relative(process.cwd(), directPath),
      console: directCollectors.logs,
      failedRequests: directCollectors.failed,
    };
    await context1.close();

    // Client navigation: start from dashboard shell, then click sidebar/link using fresh context
    const context2 = await browser.newContext({ storageState });
    const page2 = await context2.newPage();
    const clientCollectors = attachCollectors(page2);
    try {
      await page2.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
    } catch (e) {}

    // attempt to click a link to the route
    try {
      await page2.click(`a[href='${route}']`, { timeout: 5000 });
    } catch (e) {
      try { await page2.click(`[data-route='${route}']`, { timeout: 3000 }); } catch (e2) {}
    }

    try {
      await page2.waitForTimeout(1200);
      const clientPath = path.join(outDir, `client-${route === '/' ? 'root' : route.replace(/\//g, '_')}.png`);
      try { await page2.screenshot({ path: clientPath, fullPage: true }); } catch (e) {}
      entry.client = {
        url: page2.url(),
        title: await page2.title(),
        screenshot: path.relative(process.cwd(), clientPath),
        console: clientCollectors.logs,
        failedRequests: clientCollectors.failed,
      };
    } catch (e) {
      entry.client = { error: String(e) };
    }

    results.push(entry);

    await context2.close();
  }

  // Save results
  const outFile = path.join(outDir, 'navigation-results.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8');
  console.log('Saved results to', outFile);

  // basic assertion: test ran
  expect(results.length).toBe(routes.length);
});
