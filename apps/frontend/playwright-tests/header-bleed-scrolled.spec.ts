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

test('Bleed check saat navigasi dari halaman yang DI-SCROLL ke bawah', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-transaction-id]', { timeout: 15000 });
  await page.waitForTimeout(500);

  const routes = ['/dashboard', '/incomes', '/expenses', '/settings', '/notifications', '/analytics', '/transactions'];

  await page.evaluate(() => {
    const W = window as any;
    W.__log = [];
    const sample = () => {
      const header = document.querySelector('header');
      const main = document.querySelector('main');
      if (!header || !main) { W.__raf = requestAnimationFrame(sample); return; }
      const hr = header.getBoundingClientRect();
      const mr = main.getBoundingClientRect();

      // 1. Geometri shell: apakah header/main bergeser?
      // 2. Hit-test band header + garis batas main-top
      const xs = [hr.left + hr.width * 0.3, hr.left + hr.width * 0.5, hr.left + hr.width * 0.7];
      for (const y of [hr.top + 10, hr.bottom - 5]) {
        for (const x of xs) {
          const top = document.elementsFromPoint(x, y)[0];
          if (top && !(header === top || header.contains(top))) {
            W.__log.push({
              kind: 'TOPMOST_NOT_HEADER', y: Math.round(y),
              tag: top.tagName,
              cls: typeof top.className === 'string' ? top.className.slice(0, 100) : '',
            });
          }
        }
      }

      // 3. Turunan main keluar batas atas main (escape clip) — non-fixed
      let escaped = null;
      for (const el of main.querySelectorAll('*')) {
        if (getComputedStyle(el).position === 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.height === 0 || r.width === 0) continue;
        if (r.top < mr.top - 1 || r.left < mr.left - 1 || r.right > mr.right + 1) {
          escaped = {
            tag: el.tagName,
            cls: typeof el.className === 'string' ? el.className.slice(0, 90) : '',
            top: Math.round(r.top), mainTop: Math.round(mr.top),
            left: Math.round(r.left), mainLeft: Math.round(mr.left),
            right: Math.round(r.right), mainRight: Math.round(mr.right),
          };
          break;
        }
      }
      if (escaped) W.__log.push({ kind: 'ESCAPED_MAIN', ...escaped });

      // 4. Clamp/perubahan scrollTop drastis antar frame
      const st = Math.round(main.scrollTop);
      if (W.__lastST !== undefined && Math.abs(st - W.__lastST) > 50) {
        W.__log.push({ kind: 'SCROLL_JUMP', from: W.__lastST, to: st });
      }
      W.__lastST = st;

      // 5. Stabilitas geometri header & main
      const key = `${Math.round(hr.y)}|${Math.round(hr.height)}|${Math.round(mr.y)}|${Math.round(mr.x)}|${Math.round(mr.width)}`;
      if (W.__lastGeo && W.__lastGeo !== key) {
        W.__log.push({ kind: 'GEO_CHANGE', from: W.__lastGeo, to: key });
      }
      W.__lastGeo = key;

      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  const allLog: any[] = [];
  for (const href of routes) {
    await page.evaluate(() => {
      (window as any).__log = [];
      (window as any).__lastST = undefined;
      (window as any).__lastGeo = undefined;
      // Scroll main ke bawah dulu (simulasi user membaca halaman panjang)
      const m = document.querySelector('main');
      if (m) m.scrollTop = Math.min(400, Math.max(0, m.scrollHeight - m.clientHeight));
    });
    await clickNav(page, href);
    await page.locator('main h1').first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    const logs = await page.evaluate(() => (window as any).__log || []);
    logs.forEach((l: any) => allLog.push({ nav: href, ...l }));
  }

  await page.evaluate(() => cancelAnimationFrame((window as any).__raf));

  console.log(`\nTotal event: ${allLog.length}`);
  const kinds = new Map<string, number>();
  allLog.forEach(l => kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + 1));
  for (const [k, n] of kinds) console.log(`  ${k}: ${n}x`);

  // Detail contoh tiap kind
  const seen = new Set<string>();
  for (const l of allLog) {
    if (seen.has(l.kind)) continue;
    seen.add(l.kind);
    console.log(`\nContoh ${l.kind}:`, JSON.stringify(l).slice(0, 220));
  }

  // Hanya TOPMOST_NOT_HEADER yang merupakan pelanggaran visual nyata.
  // ESCAPED_MAIN = konten di-scroll di atas viewport (normal, di-clipping)
  // SCROLL_JUMP = scrollTop clamp saat route change (normal behavior)
  // GEO_CHANGE = header/main bergeser posisi (harusnya 0)
  const realViolations = allLog.filter(l => l.kind === 'TOPMOST_NOT_HEADER' || l.kind === 'GEO_CHANGE');
  console.log(`\nPelanggaran nyata: ${realViolations.length}`);
  expect(realViolations, JSON.stringify(realViolations.slice(0, 5))).toHaveLength(0);
});
