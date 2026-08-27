import { test, expect } from '@playwright/test';

test.setTimeout(180000);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3005';
const API = process.env.E2E_API_BASE || 'http://localhost:3001/api/v1';
const EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

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

// Distinctive element per route that renders synchronously with the page
// shell (independent of async data), proving the REAL page committed.
const ROUTE_MARKERS: Record<string, string> = {
  '/dashboard': 'section',
  '/transactions': 'input',
  '/accounts': 'button',
  '/reports': 'button',
  '/settings': 'button',
};

async function assertArrived(page: any, route: string) {
  await page.waitForURL((u: URL) => u.pathname === route, { timeout: 15000 });
  // Sidebar + header must remain mounted as stable anchors on every route.
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('main h1').first()).toBeVisible({ timeout: 10000 });
}

test('Fade transition aktif saat navigasi sidebar', async ({ page }) => {
  const auth = await login(page.request);
  await authPage(page, auth);
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await assertArrived(page, '/dashboard');

  // Wrapper transisi keyed-by-pathname harus ada di dalam main.
  const slotCount = await page.locator('main [data-slot="page-transition"]').count();
  expect(slotCount).toBeGreaterThanOrEqual(1);
});

test('Navigasi cepat bolak-balik antar semua menu tetap smooth & konsisten', async ({ page }) => {
  const auth = await login(page.request);
  await authPage(page, auth);
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await assertArrived(page, '/dashboard');

  const routes = [
    '/transactions',
    '/reports',
    '/analytics',
    '/budgets',
    '/categories',
    '/investments',
    '/forecast',
    '/goals',
    '/notifications',
    '/audit-log',
    '/accounts',
    '/incomes',
    '/expenses',
    '/settings',
    '/profile',
    '/dashboard',
  ];

  for (const route of routes) {
    // Klik CEPAT tanpa menunggu konten selesai (interval kecil sengaja
    // memaksa transisi ter-interrupt / bolak-balik).
    await page.locator(`aside nav a[href="${route}"]`).first().click();
    await page.waitForTimeout(120);
  }

  // Setelah spam klik, halaman terakhir (dashboard) harus tetap tampil benar.
  await assertArrived(page, '/dashboard');
  await expect(page.locator('main [data-slot="page-transition"]')).toHaveCount(1);

  // Bolak-balik penuh dengan verifikasi konten tiap halaman.
  const roundTrips: Array<[string, string]> = [
    ['/transactions', ROUTE_MARKERS['/transactions']],
    ['/reports', ROUTE_MARKERS['/reports']],
    ['/settings', ROUTE_MARKERS['/settings']],
    ['/dashboard', ROUTE_MARKERS['/dashboard']],
  ];

  for (const [route] of roundTrips) {
    await page.locator(`aside nav a[href="${route}"]`).first().click();
    await assertArrived(page, route);
    const marker = ROUTE_MARKERS[route];
    if (marker) {
      await expect(
        page.locator(`main :is(${marker})`).first()
      ).toBeVisible({ timeout: 10000 });
    }
  }
});
