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

test('Ukur fase mount /forecast: main.scrollHeight per frame', async ({ page, request }) => {
  await loginAndAuth(page, request);
  await page.goto(BASE + '/investments', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main h1', { timeout: 15000 });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const W = window as any;
    W.__f = [];
    const sample = () => {
      const main = document.querySelector('main');
      if (!main) return sched();
      const h1 = main.querySelector('h1');
      const busy = !!main.querySelector('[aria-busy="true"]');
      // state: gate-skeleton (aria-busy), forecast-skeleton (ada ChartSkeleton/skeleton pulse tanpa aria-busy), final (h1 non-kosong + tidak busy + ada section grid)
      let state = 'other';
      if (busy) state = 'gate-skeleton';
      else if (!h1 || !h1.textContent) state = 'empty';
      else if (/invest/i.test(h1.textContent)) state = 'old-page';
      else if (main.querySelectorAll('[class*="animate-pulse"]').length > 0) state = 'forecast-skeleton';
      else state = 'final-content';
      W.__f.push({
        t: Math.round(performance.now()),
        path: location.pathname,
        state,
        sh: main.scrollHeight,
      });
      sched();
      function sched() { W.__raf = requestAnimationFrame(sample); }
    };
    W.__raf = requestAnimationFrame(sample);
  });

  await page.locator('nav a[href="/forecast"]').first().click();
  await page.waitForURL(/\/forecast/);
  await page.locator('main h1').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1800);

  const frames = await page.evaluate(() => {
    cancelAnimationFrame((window as any).__raf);
    return (window as any).__f || [];
  });

  console.log('Fase (path=/forecast): state → scrollHeight');
  let prev: string | null = null;
  for (const f of frames.filter((x: any) => x.path === '/forecast')) {
    const key = `${f.state}:${f.sh}`;
    if (prev !== key) {
      console.log(`  t=${f.t}ms  ${f.state.padEnd(18)} sh=${f.sh}`);
      prev = key;
    }
  }
});
