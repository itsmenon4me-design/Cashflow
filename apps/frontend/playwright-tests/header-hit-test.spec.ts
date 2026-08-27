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

test('Hit-test zona header: elemen apa yang paling atas di piksel header selama navigasi', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main h1', { timeout: 15000 });
  await page.waitForTimeout(500);

  const routes = ['/transactions', '/incomes', '/expenses', '/budgets', '/goals', '/investments', '/reports', '/analytics', '/accounts', '/notifications', '/audit-log', '/settings'];

  // Probe: setiap frame, hit-test 5 titik di band header.
  // Titik diambil dari rect header aktual (hindari asumsi 65px).
  await page.evaluate(() => {
    const W = window as any;
    W.__topHits = [];
    const sample = () => {
      const header = document.querySelector('header');
      if (!header) { W.__raf = requestAnimationFrame(sample); return; }
      const hr = header.getBoundingClientRect();
      const xs = [hr.left + 20, hr.left + hr.width * 0.25, hr.left + hr.width * 0.5, hr.left + hr.width * 0.75, hr.right - 20];
      const y = hr.top + hr.height / 2;
      for (const x of xs) {
        // elementsFromPoint: urutan paint dari atas ke bawah
        const stack = document.elementsFromPoint(x, y);
        const top = stack[0];
        if (!top) continue;
        const inHeader = header === top || header.contains(top);
        if (!inHeader) {
          const cls = typeof top.className === 'string' ? top.className.slice(0, 110) : '';
          W.__topHits.push({
            x: Math.round(x), y: Math.round(y),
            tag: top.tagName,
            cls,
            pos: getComputedStyle(top).position,
            text: (top.textContent ?? '').trim().slice(0, 40),
            stackLen: stack.length,
          });
        }
      }
      W.__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  const allHits: any[] = [];
  for (const href of routes) {
    await page.evaluate(() => { (window as any).__topHits = []; });
    await clickNav(page, href);
    await page.locator('main h1').first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const hits = await page.evaluate(() => (window as any).__topHits || []);
    hits.forEach((h: any) => allHits.push({ route: href, ...h }));
  }

  await page.evaluate(() => cancelAnimationFrame((window as any).__raf));

  if (allHits.length) {
    console.log(`\n=== ${allHits.length} FRAME: ada elemen non-header sebagai lapisan TERATAS di zona header ===`);
    const uniq = new Map<string, any>();
    for (const h of allHits) {
      const key = `${h.route}|${h.tag}|${h.cls}`;
      if (!uniq.has(key)) uniq.set(key, { ...h, frames: 0 });
      uniq.get(key).frames++;
    }
    for (const [, h] of uniq) {
      console.log(`  ⚠ [${h.route}] <${h.tag.toLowerCase()}> pos=${h.pos} frames=${h.frames} x=${h.x},y=${h.y} cls="${h.cls}" text="${h.text}"`);
    }
  } else {
    console.log('\n=== BERSIH: header selalu lapisan teratas di semua titik sampel ===');
  }

  // Tidak fail test — ini instrumen diagnostik; laporkan temuan saja.
});
