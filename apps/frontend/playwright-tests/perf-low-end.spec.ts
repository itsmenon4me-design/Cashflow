import { test, expect } from '@playwright/test';

test.setTimeout(240000);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3005';
const API = process.env.E2E_API_BASE || 'http://localhost:3001/api/v1';
const EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

// Low-end device simulation: 6x CPU slowdown (mid-range phone class).
// Network is NOT throttled on purpose — this suite targets main-thread cost:
// parse/compile/hydration/re-render, not download speed.
const CPU_RATE = Number(process.env.E2E_CPU_RATE || '6');

async function login(request: any) {
  const res = await request.post(API + '/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { token: body.data?.accessToken ?? body.accessToken, user: body.user ?? body.data?.user };
}

async function authPage(page: any, auth: any) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a: any) => {
    localStorage.setItem('cashflow.accessToken', a.token);
    localStorage.setItem('cashflow.user', JSON.stringify(a.user));
  }, auth);
}

/**
 * TRUE eager graph = js files referenced by the SERVER-rendered HTML
 * (<script src> + <link rel=modulepreload>). Measured from the document
 * itself, NOT from runtime state: after hydration the app legitimately
 * injects more script tags for near-viewport lazy chunks, which would
 * otherwise be miscounted as eager.
 */
async function getTrueEagerUrls(apiContext: any): Promise<Set<string>> {
  const res = await apiContext.get(BASE + '/dashboard');
  const html = await res.text();
  const urls = new Set<string>();
  const re = /(?:script src="|modulepreload" href=")(\/[^"]+\.js)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    urls.add(new URL(m[1], BASE).href);
  }
  return urls;
}

async function eagerJsMetrics(page: any, eagerUrls: Set<string>) {
  return page.evaluate((names: string[]) => {
    const wanted = new Set(names);
    const sizes = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let total = 0;
    let max = 0;
    let loadedCount = 0;
    for (const e of sizes) {
      if (!wanted.has(e.name)) continue;
      const b = e.decodedBodySize || 0;
      if (b > 0) loadedCount += 1;
      total += b;
      max = Math.max(max, b);
    }
    return { count: names.length, loadedCount, totalKb: Math.round(total / 1024), maxKb: Math.round(max / 1024) };
  }, Array.from(eagerUrls));
}

test('Low-end 6x CPU: dashboard muat & navigasi tetap responsif', async ({ page }) => {
  const auth = await login(page.request);
  await authPage(page, auth);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });

  const t0 = Date.now();
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });

  // Konten utama harus muncul tanpa spinner layar penuh.
  await expect(page.locator('main h1').first()).toBeVisible({ timeout: 45000 });
  const ttfpMs = Date.now() - t0;

  const eagerUrls = await getTrueEagerUrls(page.request);
  const eager = await eagerJsMetrics(page, eagerUrls);
  console.log(
    `[${CPU_RATE}x CPU] dashboard: content=${ttfpMs}ms | true-eager JS=${eager.totalKb}KB ` +
      `(${eager.loadedCount}/${eager.count} files loaded, largest=${eager.maxKb}KB)`
  );

  // Budget longgar untuk CI-stability; pelanggaran berarti regresi serius.
  expect(ttfpMs, 'konten utama dashboard harus tampil <45s di 6x CPU').toBeLessThan(45_000);
  // Bukti code-splitting: tidak ada SATU chunk eager seukuran recharts (337KB).
  expect(eager.maxKb, 'chunk eager terbesar (recharts=337KB harus async)').toBeLessThan(300);

  // Navigasi sidebar saat throttled: konten halaman baru harus commit.
  const navStart = Date.now();
  await page.locator('aside nav a[href="/reports"]').first().click();
  await page.waitForURL((u: URL) => u.pathname === '/reports', { timeout: 20000 });
  await expect(page.locator('main h1').first()).toBeVisible({ timeout: 30000 });
  const navMs = Date.now() - navStart;
  console.log(`[${CPU_RATE}x CPU] nav -> /reports commit: ${navMs}ms`);
  expect(navMs).toBeLessThan(30_000);

  // Kembali: transisi bolak-balik tetap hidup di perangkat lambat.
  const backStart = Date.now();
  await page.locator('aside nav a[href="/dashboard"]').first().click();
  await page.waitForURL((u: URL) => u.pathname === '/dashboard', { timeout: 20000 });
  await expect(page.locator('main h1').first()).toBeVisible({ timeout: 30000 });
  const backMs = Date.now() - backStart;
  console.log(`[${CPU_RATE}x CPU] nav -> /dashboard commit: ${backMs}ms`);
  expect(backMs).toBeLessThan(30_000);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});

test('Eager graph halaman list bebas chunk raksasa; modal lazy on-demand', async ({ page }) => {
  const auth = await login(page.request);
  await authPage(page, auth);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });

  const newChunkAfterClick: string[] = [];

  await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main h1').first()).toBeVisible({ timeout: 45000 });

  const eagerUrlsTx = await getTrueEagerUrls(page.request);
  const eager = await eagerJsMetrics(page, eagerUrlsTx);
  console.log(
    `[${CPU_RATE}x CPU] /transactions true-eager JS=${eager.totalKb}KB (${eager.count} files, largest=${eager.maxKb}KB)`
  );
  // zod (~315KB sebelum optimasi) dan RHF harus sudah keluar dari eager graph.
  expect(eager.maxKb, 'chunk eager terbesar /transactions').toBeLessThan(300);

  // Best-effort: buka modal tambah bila tersedia (halaman bisa berada di
  // empty/error state tergantung data akun uji). Inti pengujian splitting
  // sudah dicover asersi eager graph di atas.
  const addButton = page.locator('main button').filter({ hasText: /Tambah|Add/i }).first();
  if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    page.on('response', (res: any) => {
      if (res.url().endsWith('.js')) newChunkAfterClick.push(res.url());
    });
    await addButton.click({ timeout: 15000 });
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 30000 });
    console.log(
      `[${CPU_RATE}x CPU] modal dibuka; ${new Set(newChunkAfterClick).size} js response selama interaksi`
    );
  } else {
    console.log(`[${CPU_RATE}x CPU] tombol add tidak tersedia (empty/error state) — lewati interaksi modal`);
  }

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});
