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

// Ukur stabilitas outer layout per frame selama dropdown berubah.
// Metrik: posisi Y ringkasan grid (elemen pertama setelah toolbar),
// scrollHeight main, dan rect h1. Selama fase loading (setelah klik opsi
// sampai data baru), tidak boleh ada perubahan >2px pada elemen-elemen ini.
test('Dropdown horizon: outer layout stabil per-frame (stale-while-revalidate)', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/forecast', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main h1', { timeout: 15000 });
  // Tunggu data awal settle penuh
  await page.waitForTimeout(1800);

  // Anchor elemen: section grid summary (pertama setelah heading+toolbar)
  const anchorInfo = await page.evaluate(() => {
    const mainEl = document.querySelector('main');
    const sections = mainEl?.querySelectorAll('section, div.rounded-xl.border');
    return {
      mainScrollHeight: mainEl?.scrollHeight,
      sectionCount: sections?.length ?? 0,
    };
  });
  console.log('Anchor info:', JSON.stringify(anchorInfo));

  await page.evaluate(() => {
    const W = window as any;
    W.__frames = [];
    const sample = () => {
      const main = document.querySelector('main');
      const h1 = document.querySelector('main h1');
      if (!main || !h1) { W.__raf = requestAnimationFrame(sample); return; }
      // Summary grid = section pertama di dalam root space-y-6
      const root = h1.parentElement?.parentElement; // space-y-6 wrapper
      const firstSection = root?.querySelector(':scope > section.grid, :scope > div.space-y-6 > div.grid');
      const r = firstSection?.getBoundingClientRect();
      const hr = h1.getBoundingClientRect();
      W.__frames.push({
        t: Math.round(performance.now()),
        h1y: Math.round(hr.y),
        secY: r ? Math.round(r.y) : null,
        secH: r ? Math.round(r.height) : null,
        sh: main.scrollHeight,
      });
      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  // Ganti dropdown bolak-balik 3→6→3
  const trigger = page.locator('#forecast-horizon');

  for (const pick of ['last', 'first'] as const) {
    await page.evaluate(() => {
      (window as any).__t0 = performance.now();
      // tandai mulai pengukuran
      (window as any).__frames = (window as any).__frames.filter((f: any) => false).concat((window as any).__frames.slice(-1));
    });
    await trigger.click();
    const options = page.locator('[role="option"]');
    await options.first().waitFor({ timeout: 5000 });
    await (pick === 'last' ? options.last() : options.first()).click();

    // Fase loading + data arrival
    await page.waitForTimeout(2200);

    // Analisis frame sejak klik: cari perubahan pada h1y/secY/sh SELAMA
    // window antara klik dan settle. Karena kita tidak punya timestamp klik
    // presisi di sisi JS, gunakan seluruh window sampling periode ini.
    const frames = await page.evaluate(() => (window as any).__frames || []);
    if (frames.length < 3) continue;

    const h1ys = frames.map((f: any) => f.h1y);
    const secYs = frames.map((f: any) => f.secY).filter((v: any) => v !== null);
    const shs = frames.map((f: any) => f.sh);

    const dH1 = Math.max(...h1ys) - Math.min(...h1ys);
    const dSecY = secYs.length ? Math.max(...secYs) - Math.min(...secYs) : 0;
    const dSh = Math.max(...shs) - Math.min(...shs);

    console.log(`[pilih ${pick}] frame=${frames.length} Δh1Y=${dH1}px ΔsummaryGridY=${dSecY}px ΔscrollHeight=${dSh}px`);

    // Ekspektasi: heading & summary grid TIDAK bergerak sama sekali.
    // scrollHeight BOLEH berubah tepat saat data baru tiba (breakdown rows
    // bertambah 3→6) — itu perubahan konten tunggal yang disengaja.
    expect(dH1, 'heading bergeser saat transisi').toBeLessThanOrEqual(2);
    expect(dSecY, 'summary grid bergeser saat transisi').toBeLessThanOrEqual(2);
  }

  await page.evaluate(() => cancelAnimationFrame((window as any).__raf));
});
