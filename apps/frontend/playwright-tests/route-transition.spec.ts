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

test('Route transition: old content tidak boleh ter-paint setelah URL berubah', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/investments', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main h1', { timeout: 15000 });
  await page.waitForTimeout(800);

  // Sampler: tiap frame catat (pathname, teks h1 utama)
  await page.evaluate(() => {
    const W = window as any;
    W.__samples = [];
    const sample = () => {
      const h1 = document.querySelector('main h1');
      W.__samples.push({
        t: Math.round(performance.now()),
        path: location.pathname,
        h1: h1?.textContent?.trim() ?? null,
      });
      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  // Navigasi Investasi → Forecast
  await page.locator('nav a[href="/forecast"]').first().click();
  await page.waitForURL(/\/forecast/);
  // Tunggu konten forecast settle
  await page.locator('main h1').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);

  const samples = await page.evaluate(() => {
    cancelAnimationFrame((window as any).__raf);
    return (window as any).__samples || [];
  });

  // Analisis: frame dengan path=/forecast tapi h1 masih milik investasi
  const investH1Samples = samples.filter((s: any) => s.h1 && /invest/i.test(s.h1));
  const leaked = investH1Samples.filter((s: any) => s.path === '/forecast');

  console.log(`Total sampel: ${samples.length}`);
  console.log(`Frame dgn h1 "Investasi": ${investH1Samples.length}`);
  console.log(`Frame LEAK (path=/forecast + h1 Investasi): ${leaked.length}`);
  if (leaked.length) {
    console.log('Contoh leak:', JSON.stringify(leaked.slice(0, 5)));
    // Durasi leak
    const tFirst = leaked[0].t;
    const tLast = leaked[leaked.length - 1].t;
    console.log(`Durasi leak: ~${tLast - tFirst}ms (${leaked.length} frame @60fps)`);
  }

  // Ulangi navigasi kedua kali (chunk sudah cache) untuk menguji repeat-nav
  await page.evaluate(() => {
    const W = window as any;
    W.__samples = [];
    const sample = () => {
      const h1 = document.querySelector('main h1');
      W.__samples.push({
        t: Math.round(performance.now()),
        path: location.pathname,
        h1: h1?.textContent?.trim() ?? null,
      });
      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  await page.locator('nav a[href="/investments"]').first().click();
  await page.waitForURL(/\/investments/);
  await page.locator('main h1').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  const samples2 = await page.evaluate(() => {
    cancelAnimationFrame((window as any).__raf);
    return (window as any).__samples || [];
  });

  const forecastH1 = samples2.filter((s: any) => s.h1 && /perkiraan|forecast|proyeksi/i.test(s.h1));
  const leaked2 = forecastH1.filter((s: any) => s.path === '/investments');
  console.log(`\n[Repeat-nav] Frame LEAK (path=/investments + h1 Forecast): ${leaked2.length}`);
  if (leaked2.length) {
    console.log(`Durasi leak: ~${leaked2[leaked2.length - 1].t - leaked2[0].t}ms`);
  }

  expect(leaked.length + leaked2.length, `${leaked.length + leaked2.length} frame menampilkan konten route lama setelah URL berubah`).toBe(0);
});
