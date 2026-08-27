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

test('Elemen keturunan main yang menembus rect header (2-sumbu)', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main h1', { timeout: 15000 });
  await page.waitForTimeout(500);

  const routes = ['/transactions', '/incomes', '/expenses', '/budgets', '/goals', '/investments', '/reports', '/analytics', '/accounts', '/notifications', '/audit-log', '/settings'];

  await page.evaluate(() => {
    const W = window as any;
    W.__hits = [];
    const sample = () => {
      const header = document.querySelector('header');
      const main = document.querySelector('main');
      if (!header || !main) { W.__raf = requestAnimationFrame(sample); return; }
      const hr = header.getBoundingClientRect();
      // Hanya turunan langsung main yang dicek (leaf-level cukup: cek semua, dedup per frame)
      for (const el of main.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Irisan DUA SUMBU dengan header rect
        const overlapsX = r.left < hr.right && r.right > hr.left;
        const overlapsY = r.top < hr.bottom - 1 && r.bottom > hr.top;
        if (overlapsX && overlapsY) {
          const cls = typeof el.className === 'string' ? el.className.slice(0, 120) : '';
          W.__hits.push({
            tag: el.tagName,
            cls,
            pos: cs.position,
            z: cs.zIndex,
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            left: Math.round(r.left),
            text: (el.textContent ?? '').trim().slice(0, 30),
          });
          break; // satu pelapor per frame cukup — catat yang pertama (paling dalam terakhir)
        }
      }
      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  const allHits: any[] = [];
  for (const href of routes) {
    await page.evaluate(() => { (window as any).__hits = []; });
    await clickNav(page, href);
    await page.locator('main h1').first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const hits = await page.evaluate(() => (window as any).__hits || []);
    hits.forEach((h: any) => allHits.push({ route: href, ...h }));
  }

  await page.evaluate(() => cancelAnimationFrame((window as any).__raf));

  if (allHits.length) {
    console.log(`\n=== ${allHits.length} FRAME PELANGGARAN (elemen main masuk zona header) ===`);
    // Ringkas: kelompokkan per class unik
    const uniq = new Map<string, any>();
    for (const h of allHits) {
      const key = `${h.route}|${h.tag}|${h.cls}`;
      if (!uniq.has(key)) uniq.set(key, h);
    }
    for (const [, h] of uniq) {
      console.log(`  ⚠ [${h.route}] <${h.tag.toLowerCase()}> pos=${h.pos} z=${h.z} top=${h.top}→bottom=${h.bottom} cls="${h.cls}" text="${h.text}"`);
    }
    console.log(`\nTotal frame pelanggaran: ${allHits.length}, elemen unik: ${uniq.size}`);
  } else {
    console.log('\n=== BERSIH: tidak ada keturunan main menyentuh zona header ===');
  }

  expect(allHits, 'Ada konten menembus header').toHaveLength(0);
});
