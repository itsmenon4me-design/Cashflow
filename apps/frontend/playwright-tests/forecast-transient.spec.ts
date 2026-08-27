import { test, expect } from '@playwright/test';

test.setTimeout(300000);

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

test('Forecast transient: overflow check setiap frame', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main h1', { timeout: 15000 });
  await page.waitForTimeout(400);

  // ── Skenario 1: navigasi ke /forecast ──
  // Sampel per-frame: untuk setiap elemen di main, cek apakah rect-nya
  // keluar dari main visible viewport (main padding box yang terlihat).
  const allViolations: any[] = [];

  await page.evaluate(() => {
    const W = window as any;
    W.__v = [];
    const TOL = 1;
    const sample = () => {
      const main = document.querySelector('main');
      if (!main) { W.__raf = requestAnimationFrame(sample); return; }
      const mainR = main.getBoundingClientRect();
      // Visible boundary: main's padding box top + padding left to right
      const padTop = mainR.top + (parseFloat(getComputedStyle(main).paddingTop) || 0);
      const padLeft = mainR.left + (parseFloat(getComputedStyle(main).paddingLeft) || 0);
      const padRight = mainR.right - (parseFloat(getComputedStyle(main).paddingRight) || 0);

      // Cek semua elemen: apakah mereka visible DAN melebihi boundary?
      const allEls = main.querySelectorAll('*');
      for (const el of allEls) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (cs.position === 'fixed') continue;

        // Hanya elemen yang SEBAGIAN terlihat di viewport (visible)
        // atau sedikit di atas (overflowing upward)
        const overlapWithMain = r.bottom > mainR.top && r.top < mainR.bottom;
        if (!overlapWithMain) continue;

        // Cek apakah elemen ini melebihi nearest clipped ancestor
        // Secara sederhana: cek apakah elemen melebihi main pada sisi manapun
        // Karena main punya overflow-y-auto, content seharusnya ter-clip

        // LEBIH PENTING: cek apakah elemen MELEBIHI main's visible area
        // dari SISI ATAS (top < padTop) padahal bukan header
        if (r.top < padTop - TOL) {
          // Verifikasi: apakah titik ini benar-benar menampilkan elemen ini?
          const probeX = Math.max(Math.min(r.left + r.width / 2, padRight - 2), padLeft + 2);
          const topmost = document.elementsFromPoint(probeX, Math.max(r.top, padTop - 5))[0];
          const visuallyOutside = topmost === el || el.contains(topmost) || topmost?.contains(el);
          if (visuallyOutside) {
            W.__v.push({
              t: Math.round(performance.now()),
              tag: el.tagName,
              cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80),
              top: Math.round(r.top),
              mainTop: Math.round(padTop),
              text: (el.textContent ?? '').trim().slice(0, 30),
            });
          }
        }

        // Cek juga elemen yang melebihi main's bottom tanpa scroll (content leak)
        // Hanya jika main scrollTop=0 (tidak di-scroll)
        if (main.scrollTop <= 1 && r.bottom > mainR.bottom + TOL) {
          const probeX = Math.max(Math.min(r.left + r.width / 2, padRight - 2), padLeft + 2);
          const topmost = document.elementsFromPoint(probeX, Math.min(r.bottom, mainR.bottom + 5))[0];
          const visuallyOutside = topmost === el || el.contains(topmost) || topmost?.contains(el);
          if (visuallyOutside) {
            W.__v.push({
              t: Math.round(performance.now()),
              tag: el.tagName,
              cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80),
              bottom: Math.round(r.bottom),
              mainBottom: Math.round(mainR.bottom),
              text: (el.textContent ?? '').trim().slice(0, 30),
            });
          }
        }
      }
      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  // Skenario 1: navigasi
  await page.locator('nav a[href="/forecast"]').first().click();
  await page.waitForURL(/\/forecast/);
  await page.locator('main h1').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  let viol = await page.evaluate(() => { cancelAnimationFrame((window as any).__raf); return (window as any).__v || []; });
  allViolations.push(...viol.map((v: any) => ({ ...v, phase: 'nav' })));
  console.log(`[nav→/forecast] violations: ${viol.length}`);

  // Skenario 2: ganti dropdown
  await page.evaluate(() => { (window as any).__v = []; });
  await page.evaluate(() => { (window as any).__raf = requestAnimationFrame((window as any).__sampleFn || (()=>{})); });
  // Re-inject
  await page.evaluate(() => {
    const W = window as any;
    if (W.__raf) cancelAnimationFrame(W.__raf);
    const main = document.querySelector('main');
    if (!main) return;
    const TOL = 1;
    const sample = () => {
      const mainR = main.getBoundingClientRect();
      const padTop = mainR.top + (parseFloat(getComputedStyle(main).paddingTop) || 0);
      const padLeft = mainR.left + (parseFloat(getComputedStyle(main).paddingLeft) || 0);
      const padRight = mainR.right - (parseFloat(getComputedStyle(main).paddingRight) || 0);
      for (const el of main.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
        if (r.bottom <= mainR.top || r.top >= mainR.bottom) continue;
        if (r.top < padTop - TOL) {
          const px = Math.max(Math.min(r.left + r.width / 2, padRight - 2), padLeft + 2);
          const top = document.elementsFromPoint(px, Math.max(r.top, padTop - 5))[0];
          if (top === el || el.contains(top) || top?.contains(el)) {
            W.__v.push({ tag: el.tagName, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80), top: Math.round(r.top), padTop: Math.round(padTop) });
          }
        }
      }
      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  const trigger = page.locator('#forecast-horizon');
  await trigger.click();
  await page.locator('[role="option"]').last().waitFor({ timeout: 5000 });
  await page.locator('[role="option"]').last().click();
  await page.waitForTimeout(2000);
  await trigger.click();
  await page.locator('[role="option"]').first().waitFor({ timeout: 5000 });
  await page.locator('[role="option"]').first().click();
  await page.waitForTimeout(2000);

  viol = await page.evaluate(() => { cancelAnimationFrame((window as any).__raf); return (window as any).__v || []; });
  allViolations.push(...viol.map((v: any) => ({ ...v, phase: 'dropdown' })));
  console.log(`[dropdown] violations: ${viol.length}`);

  console.log(`\nTotal violations: ${allViolations.length}`);
  allViolations.slice(0, 10).forEach((v: any) =>
    console.log(`  ⚠ [${v.phase}] <${v.tag.toLowerCase()}> top=${v.top} mainTop=${v.padTop} cls="${v.cls}" text="${v.text ?? ''}"`)
  );
});
