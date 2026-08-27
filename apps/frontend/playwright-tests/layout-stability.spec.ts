import { test, expect } from '@playwright/test';

test.setTimeout(180000);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API = process.env.E2E_API_BASE || 'http://localhost:3001/api/v1';
const EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

interface Rect { x: number; y: number; width: number; height: number }

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

async function rects(page: any): Promise<Record<string, Rect | null>> {
  return page.evaluate((): Record<string, Rect | null> => {
    const grab = (selector: string): Rect | null => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    return {
      sidebar: grab('aside') ?? grab('[class*="w-64"][class*="border-r"]'),
      header: grab('header'),
      main: grab('main'),
    };
  });
}

test('Layout stabil saat navigasi antar semua menu', async ({ page, request }) => {
  const auth = await login(request);
  await authPage(page, auth);

  const routes = [
    '/transactions', '/incomes', '/expenses', '/budgets', '/goals',
    '/investments', '/reports', '/analytics', '/accounts', '/categories',
    '/notifications', '/audit-log', '/bills', '/settings', '/dashboard',
  ];

  let baseline: Record<string, Rect | null> | null = null;
  const failures: string[] = [];

  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const current = await rects(page);

    expect(current.sidebar, `[${route}] sidebar tidak ditemukan`).toBeTruthy();
    expect(current.header, `[${route}] header tidak ditemukan`).toBeTruthy();
    expect(current.main, `[${route}] main tidak ditemukan`).toBeTruthy();

    if (!baseline) {
      baseline = current;
      console.log(`Baseline (${route}):`, JSON.stringify(current));
      continue;
    }

    for (const key of ['sidebar', 'header', 'main'] as const) {
      const b = baseline[key]!;
      const c = current[key]!;
      for (const prop of ['x', 'y', 'width', 'height'] as const) {
        if (Math.abs(b[prop] - c[prop]) > 1) {
          failures.push(
            `[${route}] ${key}.${prop}: baseline=${b[prop]} actual=${c[prop]} (delta=${c[prop] - b[prop]})`
          );
        }
      }
    }
  }

  if (failures.length) {
    console.log('LAYOUT SHIFT TERDETEKSI:\n' + failures.join('\n'));
  } else {
    console.log(`Semua ${routes.length} menu: sidebar/header/main posisi & ukuran identik`);
  }
  expect(failures, failures.join('\n')).toHaveLength(0);
});
