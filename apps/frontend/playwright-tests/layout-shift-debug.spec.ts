import { test, expect } from '@playwright/test';

test.setTimeout(180000);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API  = process.env.E2E_API_BASE  || 'http://localhost:3001/api/v1';
const EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const PASS = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

/* ── helpers ────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sample = Record<string, any>;
type Entry = { phase: string; samples: Sample[] };

async function login(request: any) {
  const r = await request.post(API + '/auth/login', { data: { email: EMAIL, password: PASS } });
  expect(r.ok()).toBeTruthy();
  const b = await r.json();
  return { token: b.data?.accessToken ?? b.accessToken, user: b.user ?? b.data?.user };
}

async function seedAuth(page: any, auth: any) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a: any) => {
    localStorage.setItem('cashflow.accessToken', a.token);
    localStorage.setItem('cashflow.user', JSON.stringify(a.user));
  }, auth);
}

// Inject per-frame sampler + start recording from next animation frame.
// Call stop() to halt; result is all samples collected.
async function injectSampler(page: any): Promise<void> {
  await page.evaluate(() => {
    const W = window as any;
    W.__samples = [];
    const grab = (sel: string) => document.querySelector(sel) as HTMLElement | null;
    const els = () => ({
      sidebar: grab('aside'),
      header:  grab('header'),
      main:    grab('main'),
      h1:      document.querySelector('main h1') as HTMLElement | null,
      body:    document.body,
    });
    const sample = () => {
      const t = performance.now();
      const e = els();
      const r: any = { t };
      for (const [k, el] of Object.entries(e)) {
        if (!el) { r[k] = null; continue; }
        const b = el.getBoundingClientRect();
        r[k] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      }
      // Tag h1 dengan teksnya — sampler lintas rute membedah h1 halaman BERBEDA
      r.h1Text = e.h1 ? e.h1.textContent?.trim() : null;
      r.scrollTop = e.main ? Math.round(e.main.scrollTop) : null;
      r.scrollHeight = e.main ? e.main.scrollHeight : null;
      r.clientWidth = document.body.clientWidth;
      W.__samples.push(r);
      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });
}

async function stopSampler(page: any): Promise<any[]> {
  return page.evaluate(() => {
    const W = window as any;
    if (W.__raf) cancelAnimationFrame(W.__raf);
    const s = W.__samples || [];
    delete W.__samples;
    delete W.__raf;
    return s;
  });
}

// Click sidebar link by href text
async function clickNav(page: any, href: string) {
  await page.locator(`nav a[href="${href}"]`).first().click();
  await page.waitForURL(new RegExp(href.replace('/', '\\/')));
}

/* ── debug test ─────────────────────────────────────────────────────── */

test('Runtime layout shift debug: sampel per-frame setelah setiap navigasi', async ({ page, request }) => {
  const auth = await login(request);
  await seedAuth(page, auth);

  const routes = [
    '/dashboard',
    '/transactions',
    '/incomes',
    '/expenses',
    '/budgets',
    '/goals',
    '/investments',
    '/forecast',
    '/reports',
    '/analytics',
    '/accounts',
    '/categories',
    '/notifications',
    '/audit-log',
    '/settings',
  ];

  // 1. Sampel baseline di halaman awal tanpa inject (tunggu settle)
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.waitForTimeout(500);

  const BASELINE = await page.evaluate(() => {
    const grab = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect() : null;
    };
    const m = document.querySelector('main') as any;
    return {
      sidebar: grab('aside'),
      header:  grab('header'),
      main:    grab('main'),
      h1:      grab('main h1'),
    };
  });

  console.log('BASELINE rects:', JSON.stringify(BASELINE, null, 0));

  // 2. Navigasi berulang, sampel per-frame
  const entries: Entry[] = [];

  await injectSampler(page);

  for (let i = 0; i < routes.length; i++) {
    const href = routes[i];
    const tag = `nav→${href} (from ${i === 0 ? 'baseline' : routes[i - 1]})`;

    // Clear samples, navigate via sidebar click
    await page.evaluate(() => { (window as any).__samples = []; });

    // Click sidebar link
    await clickNav(page, href);

    // Tunggu halaman settle (h1 rendered, network idle-ish)
    await page.locator('main h1').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);

    const samps = await page.evaluate(() => (window as any).__samples || []);
    entries.push({ phase: tag, samples: samps });
  }

  // Stop sampler
  await stopSampler(page);

  // 3. Analisis: cek apakah ada perubahan posisi/ukuran SEMASA transisi
  const issues: string[] = [];
  const SHIFT_THRESHOLD_PX = 2;

  for (const entry of entries) {
    const { phase, samples } = entry;
    if (samples.length < 3) {
      issues.push(`${phase}: hanya ${samples.length} sampel (terlalu sedikit)`);
      continue;
    }

    // Hitung min/max untuk setiap elemen per fase
    for (const key of ['sidebar', 'header', 'main', 'body'] as const) {
      const vals = samples.filter(s => s[key]).map(s => ({
        x: s[key].x, y: s[key].y, w: s[key].w, h: s[key].h
      }));
      if (!vals.length) continue;

      const minX = Math.min(...vals.map(v => v.x));
      const maxX = Math.max(...vals.map(v => v.x));
      const minY = Math.min(...vals.map(v => v.y));
      const maxY = Math.max(...vals.map(v => v.y));
      const minW = Math.min(...vals.map(v => v.w));
      const maxW = Math.max(...vals.map(v => v.w));
      const minH = Math.min(...vals.map(v => v.h));
      const maxH = Math.max(...vals.map(v => v.h));

      const dx = maxX - minX;
      const dy = maxY - minY;
      const dw = maxW - minW;
      const dh = maxH - minH;

      if (dx > SHIFT_THRESHOLD_PX) issues.push(`${phase} [${key}] horizontal shift: x ${minX}→${maxX} (±${Math.round(dx/2)}px)`);
      if (dy > SHIFT_THRESHOLD_PX) issues.push(`${phase} [${key}] vertical shift: y ${minY}→${maxY} (±${Math.round(dy/2)}px)`);
      if (dw > SHIFT_THRESHOLD_PX) issues.push(`${phase} [${key}] width change: w ${minW}→${maxW} (Δ${dw}px)`);
      if (dh > SHIFT_THRESHOLD_PX) issues.push(`${phase} [${key}] height change: h ${minH}→${maxH} (Δ${dh}px)`);
    }

    // h1 dikelompokkan per TEKS — hanya flag bila h1 HALAMAN YANG SAMA berubah ukuran
    {
      const byText = new Map<string, typeof samples>();
      for (const s of samples) {
        if (!s.h1 || !s.h1Text) continue;
        const arr = byText.get(s.h1Text) ?? [];
        arr.push(s);
        byText.set(s.h1Text, arr);
      }
      for (const [text, arr] of byText) {
        const ws = arr.map(s => s.h1.w);
        const xs = arr.map(s => s.h1.x);
        const ys = arr.map(s => s.h1.y);
        if (Math.max(...ws) - Math.min(...ws) > SHIFT_THRESHOLD_PX)
          issues.push(`${phase} [h1 "${text.slice(0,20)}"] width change within same page: ${Math.min(...ws)}→${Math.max(...ws)}`);
        if (Math.max(...xs) - Math.min(...xs) > SHIFT_THRESHOLD_PX)
          issues.push(`${phase} [h1 "${text.slice(0,20)}"] x shift within same page: ${Math.min(...xs)}→${Math.max(...xs)}`);
        if (Math.max(...ys) - Math.min(...ys) > SHIFT_THRESHOLD_PX)
          issues.push(`${phase} [h1 "${text.slice(0,20)}"] y shift within same page: ${Math.min(...ys)}→${Math.max(...ys)}`);
      }
    }

    // Cek body width (apakah toolbar/dropdown menyebabkan body resize)
    const bws = samples.map(s => s.clientWidth);
    const minBW = Math.min(...bws);
    const maxBW = Math.max(...bws);
    if (maxBW - minBW > 2) {
      issues.push(`${phase} [body] width ${minBW}→${maxBW} — layout container berubah!`);
    }
  }

  // Output
  if (issues.length) {
    console.log(`\n=== LAYOUT SHIFT TERDETEKSI (${issues.length} masalah) ===`);
    issues.forEach(i => console.log('  ⚠ ' + i));
  } else {
    console.log(`\n=== STABIL: ${routes.length} navigasi × frame sampling, tidak ada shift >2px ===`);
  }

  // Output per-route summary untuk referensi
  console.log(`\nRute: ${routes.length}, sampel/rute: ~100 frame`);

  // Fails test jika ada shift
  expect(issues, issues.join('\n')).toHaveLength(0);
});
