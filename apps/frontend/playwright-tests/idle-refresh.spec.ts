import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

const outDir = path.resolve(process.cwd(), 'playwright-results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function attachCollectors(page: any) {
  const logs: any[] = [];
  const requests: any[] = [];
  page.on('console', (m: any) => {
    try { logs.push({ type: m.type(), text: m.text() }); } catch(e) {}
  });
  page.on('pageerror', (err: any) => logs.push({ type: 'pageerror', text: String(err) }));
  page.on('request', (req: any) => requests.push({ type: 'request', url: req.url(), method: req.method() }));
  page.on('response', async (res: any) => {
    try {
      requests.push({ type: 'response', url: res.url(), status: res.status() });
    } catch(e) {}
  });
  page.on('requestfailed', (req: any) => {
    try { requests.push({ type: 'requestfailed', url: req.url(), method: req.method(), failure: req.failure()?.errorText }); } catch(e) {}
  });
  page.on('dialog', (d: any) => { try { d.dismiss(); } catch(e) {} });
  return { logs, requests };
}

test('idle 70s on dashboard - observe auto-refresh behavior', async ({ browser }) => {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error('Missing E2E credentials');
  }

  const contextAuth = await browser.newContext();
  const pageAuth = await contextAuth.newPage();
  await pageAuth.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await pageAuth.fill('#email', E2E_EMAIL);
  await pageAuth.fill('#password', E2E_PASSWORD);
  await Promise.all([
    pageAuth.click("button[type='submit']"),
    pageAuth.waitForURL((url: any) => !url.pathname.includes('/login'), { timeout: 15000 }).catch(() => undefined),
  ]);
  await pageAuth.waitForLoadState('networkidle');
  const storage = await contextAuth.storageState();
  await contextAuth.close();

  const ctx = await browser.newContext({ storageState: storage });
  const page = await ctx.newPage();
  const collectors = attachCollectors(page);

  // Go to dashboard and record initial screenshot
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const beforeShot = path.join(outDir, 'idle-before.png');
  await page.screenshot({ path: beforeShot, fullPage: true });

  const startUrl = page.url();

  // Wait 70 seconds while collecting logs
  const idleMs = 70_000;
  console.log('Idling for', idleMs, 'ms');
  await page.waitForTimeout(idleMs);

  // After idle, take screenshot and save logs
  await page.waitForTimeout(500);
  const afterShot = path.join(outDir, 'idle-after.png');
  await page.screenshot({ path: afterShot, fullPage: true });

  const result = {
    startUrl,
    finalUrl: page.url(),
    beforeScreenshot: path.relative(process.cwd(), beforeShot),
    afterScreenshot: path.relative(process.cwd(), afterShot),
    console: collectors.logs,
    network: collectors.requests,
  };

  fs.writeFileSync(path.join(outDir, 'idle-results.json'), JSON.stringify(result, null, 2), 'utf8');

  // Basic assertions: still on dashboard and no full-page reload (url unchanged)
  expect(result.finalUrl).toContain('/dashboard');
});
