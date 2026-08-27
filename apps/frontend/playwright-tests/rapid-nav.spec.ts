import { test, expect } from '@playwright/test';

test.setTimeout(240000);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API  = process.env.E2E_API_BASE  || 'http://localhost:3001/api/v1';
const EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const PASS = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

async function loginAndAuth(page: any, request: any) {
  const r = await request.post(API + '/auth/login', { data: { email: EMAIL, password: PASS } });
  const b = await r.json();
  const auth = { token: b.data?.accessToken ?? b.accessToken, user: b.user ?? b.data?.user };
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a: any) => {
    localStorage.setItem('cashflow.accessToken', a.token);
    localStorage.setItem('cashflow.user', JSON.stringify(a.user));
  }, auth);
}

async function clickNav(page: any, href: string) {
  await page.locator(`nav a[href="${href}"]`).first().click();
  await page.waitForURL(new RegExp(href.replace('/', '\\/')));
}

// Navigasi cepat bolak-balik Laporan↔Perkiraan↔Analitik.
// Deteksi flash skeleton "Pemasukan yang…" pada /forecast:
// frame dengan path=/forecast yang memuat teks label summary card loading.
test('Rapid nav: tidak ada skeleton-flash di /forecast', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/reports', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main h1', { timeout: 15000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const W = window as any;
    W.__frames = [];
    const sample = () => {
      const main = document.querySelector('main');
      if (!main) return sched();
      // Flash detector: label summary-card loading terlihat saat path=/forecast
      const hasLoadingLabel = Array.from(main.querySelectorAll('p')).some(
        (p) => /Pemasukan yang diproyeksikan/i.test(p.textContent ?? '') &&
               p.closest('[class*="animate-pulse"], [aria-busy="true"]')
      );
      const h1 = main.querySelector('h1')?.textContent?.trim() ?? '';
      let state = 'other';
      if (main.querySelector('[aria-busy="true"]')) state = 'gate-skeleton';
      else if (/invest|laporan|analitik/i.test(h1)) state = h1.toLowerCase().includes('perkiraan') ? 'other' : 'old-page';
      else if (/perkiraan/i.test(h1)) state = main.querySelector('[class*="animate-pulse"]') ? 'forecast-skeleton' : 'final';
      else if (!h1) state = 'empty';
      W.__frames.push({
        path: location.pathname,
        s: hasLoadingLabel ? 'FLASH-SKELETON-LABEL' : state,
        h1,
      });
      sched();
      function sched() { W.__raf = requestAnimationFrame(sample); }
    };
    W.__raf = requestAnimationFrame(sample);
  });

  // Bolak-balik cepat 4x
  for (let i = 0; i < 4; i++) {
    await clickNav(page, '/forecast');
    await page.locator('main h1').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    await clickNav(page, '/reports');
    await page.locator('main h1').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    await clickNav(page, '/analytics');
    await page.locator('main h1').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    await clickNav(page, '/forecast');
    await page.locator('main h1').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
  }

  const frames = await page.evaluate(() => {
    cancelAnimationFrame((window as any).__raf);
    return (window as any).__frames || [];
  });

  const post = frames.filter((f: any) => f.path === '/forecast');
  const flashes = post.filter((f: any) => f.s === 'FLASH-SKELETON-LABEL');
  const oldLeak = post.filter((f: any) => f.s === 'old-page');

  console.log(`Frame path=/forecast: ${post.length}`);
  console.log(`Skeleton-label flash ("Pemasukan yang…"): ${flashes.length}`);
  console.log(`Konten lama leak: ${oldLeak.length}`);

  const seqSummary: Record<string, number> = {};
  post.forEach((f: any) => { seqSummary[f.s] = (seqSummary[f.s] ?? 0) + 1; });
  console.log('Distribusi state:', JSON.stringify(seqSummary));

  expect(flashes.length, `${flashes.length} frame skeleton berlabel terlihat di /forecast`).toBe(0);
  expect(oldLeak.length, `${oldLeak.length} frame konten lama di /forecast`).toBe(0);
});
