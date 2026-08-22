import { test } from '@playwright/test';

const BASE = 'http://localhost:3000';
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;

if (!E2E_EMAIL || !E2E_PASSWORD) throw new Error('Missing E2E credentials');

test('debug a[href="/bills"] elements before clicking', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#email', E2E_EMAIL);
  await page.fill('#password', E2E_PASSWORD);
  await Promise.all([
    page.click("button[type='submit']"),
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => undefined),
  ]);
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }).catch(() => {});

  // Evaluate DOM for all matching anchors
  const results = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("a[href='/bills']"));
    return nodes.map((n) => {
      const el = n as HTMLElement;
      const style = window.getComputedStyle(el);
      return {
        outerHTML: el.outerHTML,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        bounding: el.getBoundingClientRect ? el.getBoundingClientRect().toJSON() : null,
        tabindex: el.getAttribute('tabindex'),
        ariaHidden: el.getAttribute('aria-hidden'),
        className: el.className,
      };
    });
  });

  console.log('BILLS_ANCHORS_DEBUG', JSON.stringify(results, null, 2));
  // Also screenshot
  await page.screenshot({ path: 'playwright-results/check-bills-debug-before.png', fullPage: true }).catch(() => {});
  await ctx.close();
});