import { test } from '@playwright/test';

test.setTimeout(180000);

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

test('Elemen mana yang tumbuh 1376→1754?', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/investments', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main h1', { timeout: 15000 });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const W = window as any;
    W.__f = [];
    // Snapshot anak-anak root space-y-6: tag+class ringkas → height map
    const snapshot = () => {
      const main = document.querySelector('main');
      if (!main) return null;
      const h1 = main.querySelector('h1');
      const root = h1?.parentElement?.parentElement;
      if (!root) return null;
      const kids: Array<{ k: string; h: number }> = [];
      Array.from(root.children).forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const cls = typeof el.className === 'string' ? el.className.slice(0, 40) : '';
        kids.push({ k: `${i}:${el.tagName}.${cls}`, h: Math.round(r.height) });
      });
      return { sh: main.scrollHeight, kids };
    };

    const sample = () => {
      const s = snapshot();
      if (s) (window as any).__f.push({ t: Math.round(performance.now()), ...s });
      (window as any).__raf = requestAnimationFrame(sample);
    };
    W.__raf = requestAnimationFrame(sample);
  });

  await page.locator('nav a[href="/forecast"]').first().click();
  await page.waitForURL(/\/forecast/);
  await page.locator('main h1').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(2000);

  const frames = await page.evaluate(() => {
    cancelAnimationFrame((window as any).__raf);
    return (window as any).__f || [];
  });

  // Temukan frame di mana sh berubah signifikan (>50px) dan bandingkan kids
  console.log('Perubahan scrollHeight >50px:');
  let prevSh = 0; let prevKids: any = null;
  for (const f of frames) {
    if (prevSh && Math.abs(f.sh - prevSh) > 50 && f.kids?.length) {
      console.log(`\n@t=${f.t}ms sh ${prevSh}→${f.sh}`);
      if (prevKids) {
        for (const k of f.kids) {
          const before = prevKids.find((p: any) => p.k === k.k);
          if (!before) {
            console.log(`   + BARU  [${k.k}] h=${k.h}`);
          } else if (Math.abs(before.h - k.h) > 20) {
            console.log(`   ~ UBAH  [${k.k}] h=${before.h}→${k.h}`);
          }
        }
        for (const p of prevKids) {
          if (!f.kids.find((k: any) => k.k === p.k)) {
            console.log(`   - HILANG [${p.k}] h=${p.h}`);
          }
        }
      }
    }
    prevSh = f.sh; prevKids = f.kids;
  }
});
