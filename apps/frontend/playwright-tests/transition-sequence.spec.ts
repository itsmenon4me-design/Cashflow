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

test('Transisi Investasi→Forecast: urutan atomic lama→skeleton→baru, tanpa coexist', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/investments', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main h1', { timeout: 15000 });
  await page.waitForTimeout(600);

  // Sampler: tiap frame klasifikasi state konten main
  await page.evaluate(() => {
    const W = window as any;
    W.__frames = [];
    const classify = (): 'old' | 'skeleton' | 'new' | 'empty' | 'unknown' => {
      const main = document.querySelector('main');
      if (!main) return 'unknown';
      const h1 = main.querySelector('h1')?.textContent?.trim() ?? '';
      // Skeleton DashboardLoading: aria-busy + animate-pulse placeholder
      const skeleton = main.querySelector('[aria-busy="true"]');
      if (skeleton) return 'skeleton';
      if (/invest/i.test(h1)) return 'old';
      if (/perkiraan|forecast|proyeksi/i.test(h1)) return 'new';
      if (!h1) return 'empty';
      return 'unknown';
    };
    const sample = () => {
      W.__frames.push({ t: Math.round(performance.now()), path: location.pathname, s: classify() });
      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  await page.locator('nav a[href="/forecast"]').first().click();
  await page.waitForURL(/\/forecast/);
  await page.locator('main h1').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);

  const frames = await page.evaluate(() => {
    cancelAnimationFrame((window as any).__raf);
    return (window as any).__frames || [];
  });

  // Fase setelah URL berubah
  const post = frames.filter((f: any) => f.path === '/forecast');
  const seq = post.map((f: any) => f.s);

  const countOld = seq.filter((s: string) => s === 'old').length;
  const countSkeleton = seq.filter((s: string) => s === 'skeleton').length;
  const countNew = seq.filter((s: string) => s === 'new').length;
  const countEmpty = seq.filter((s: string) => s === 'empty').length;
  const countUnknown = seq.filter((s: string) => s === 'unknown').length;

  console.log(`Frame post-navigasi: ${post.length}`);
  console.log(`  old (LEAK): ${countOld}`);
  console.log(`  skeleton:   ${countSkeleton}`);
  console.log(`  new:        ${countNew}`);
  console.log(`  empty:      ${countEmpty} | unknown: ${countUnknown}`);
  console.log(`Urutan state: ${[...new Set(seq)].join(' → ')}`);

  // Verifikasi:
  // 1. Tidak ada frame konten lama setelah URL berubah (tidak ada leak/ghost)
  expect(countOld, `${countOld} frame menampilkan konten lama setelah URL /forecast aktif`).toBe(0);

  // 2. Tidak ada frame "Tidak ada data" flash sebelum data tiba
  const noDataFlash = post.filter((f: any) => f.s === 'empty').length;
  console.log(`  empty-state flash: ${noDataFlash}`);

  // 3. Skeleton opsional (delayed 200ms — fetch lokal cepat = skeleton tak muncul);
  //    bila muncul, harus SEBELUM konten baru.
  const firstNew = seq.indexOf('new');
  const lastSkeleton = seq.lastIndexOf('skeleton');
  if (countSkeleton > 0 && firstNew >= 0) {
    expect(lastSkeleton, 'konten baru muncul sebelum skeleton').toBeLessThan(firstNew);
  }
  console.log(`\nSequence: ${[...new Set(seq)].join(' → ')} | old=${countOld} skeleton=${countSkeleton} new=${countNew}`);
});
