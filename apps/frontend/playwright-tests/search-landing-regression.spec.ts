import { test, expect } from '@playwright/test';

test.setTimeout(240000);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3101/api/v1';
const USER_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const USER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

// Group labels as rendered by the search panel (id locale is the default).
const GROUPS = {
  transactions: 'Transaksi',
  accounts: 'Akun',
  insights: 'Wawasan',
  categories: 'Kategori',
  budgets: 'Anggaran',
  savingGoals: 'Target Tabungan',
  investments: 'Investasi',
  notifications: 'Notifikasi',
};

async function login(request: any) {
  const res = await request.post(API_BASE + '/auth/login', {
    data: { email: USER_EMAIL, password: USER_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const data = body?.data ?? body;
  return { token: data.accessToken, refresh: data.refreshToken };
}

function authHeaders(auth: any) {
  return { Authorization: 'Bearer ' + auth.token };
}

async function seedAuth(page: any, auth: any) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ token, refresh, email }: { token: string; refresh: string; email: string }) => {
      try {
        localStorage.setItem('cashflow.accessToken', token);
        localStorage.setItem('cashflow.refreshToken', refresh);
        localStorage.setItem(
          'cashflow.user',
          JSON.stringify({ name: 'E2E Tester', email }),
        );
        localStorage.setItem('cashflow-dashboard-currency', 'IDR');
      } catch (e) {}
    },
    { token: auth.token, refresh: auth.refresh, email: USER_EMAIL },
  );
}

/** Open the global search, type the term, and click the first option inside the given group. */
async function searchAndClickResult(
  page: any,
  term: string,
  groupLabel: string,
) {
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  const input = page
    .locator('header input[aria-label="Pencarian global"], header input[aria-label="Global search"]')
    .first();
  await expect(input).toBeVisible({ timeout: 20000 });
  await input.click();
  await input.fill('');
  await input.pressSequentially(term, { delay: 30 });

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible({ timeout: 20000 });

  const group = listbox.locator('> div').filter({
    has: page.locator('p', { hasText: groupLabel }),
  });
  const option = group.locator('[role="option"]').first();
  await expect(option).toBeVisible({ timeout: 20000 });
  await option.click();
}

test.describe('global search landing regression (all data types)', () => {
  // The global playwright.config storageState belongs to a different automation
  // user; this spec seeds and drives the e2e.api user explicitly, so start from
  // a clean session.
  test.use({ storageState: { cookies: [], origins: [] } });

  let auth: any;
  const suffix = Date.now();
  const unique = `S4-${suffix}`;
  const txNote = `E2E landing target ${unique}`;
  const categoryName = `E2E Landing Cat ${unique}`;
  const goalName = `E2E Landing Goal ${unique}`;
  const investmentName = `E2E Landing Invest ${unique}`;

  let txId: string | null = null;
  let categoryId: string | null = null;
  let budgetId: string | null = null;
  let goalId: string | null = null;
  let investmentId: string | null = null;

  test.beforeAll(async ({ request }) => {
    auth = await login(request);
    const h = authHeaders(auth);

    // --- transaction dated TWO months ago (outside the current-month default filter)
    const cats = await request.get(API_BASE + '/categories', { headers: h });
    const catsBody = await cats.json();
    const expenseCat =
      (catsBody?.data ?? []).find((c: any) => c.name === 'Food') ??
      (catsBody?.data ?? []).find((c: any) => c.type === 'EXPENSE');
    expect(expenseCat).toBeTruthy();

    const accs = await request.get(API_BASE + '/accounts?currency=IDR', { headers: h });
    const accsBody = await accs.json();
    const idrAcc = (accsBody?.data ?? []).find((a: any) => a.currency === 'IDR');
    expect(idrAcc).toBeTruthy();

    const past = new Date();
    past.setMonth(past.getMonth() - 2);
    const pastYear = past.getFullYear();
    const pastMonth = past.getMonth() + 1; // 1-based
    const pastIso = `${pastYear}-${String(pastMonth).padStart(2, '0')}-15T10:00:00.000Z`;

    const tx = await request.post(API_BASE + '/transactions', {
      headers: h,
      data: {
        account_id: idrAcc.id,
        category_id: expenseCat.id,
        transaction_type: 'EXPENSE',
        amount_cents: 77000,
        transaction_date: pastIso,
        note: txNote,
      },
    });
    expect(tx.ok()).toBeTruthy();
    txId = (await tx.json())?.data?.id ?? null;

    // --- unique category
    const cat = await request.post(API_BASE + '/categories', {
      headers: h,
      data: { name: categoryName, type: 'EXPENSE', description: unique },
    });
    expect(cat.ok()).toBeTruthy();
    categoryId = (await cat.json())?.data?.id ?? null;

    // --- budget for the unique category in the SAME past month (outside current-month period)
    if (categoryId) {
      const budget = await request.post(API_BASE + '/budgets', {
        headers: h,
        data: {
          category_id: categoryId,
          currency: 'IDR',
          budget_amount_cents: 500000,
          month: pastMonth,
          year: pastYear,
        },
      });
      expect(budget.ok()).toBeTruthy();
      budgetId = (await budget.json())?.data?.id ?? null;
    }

    // --- saving goal
    const goal = await request.post(API_BASE + '/saving-goals', {
      headers: h,
      data: {
        name: goalName,
        target_amount_cents: 1000000,
        start_date: new Date().toISOString(),
        target_date: new Date(Date.now() + 90 * 86400000).toISOString(),
      },
    });
    expect(goal.ok()).toBeTruthy();
    goalId = (await goal.json())?.data?.id ?? null;

    // --- investment
    const investment = await request.post(API_BASE + '/investments', {
      headers: h,
      data: {
        investment_type: 'Stock',
        platform: 'E2E Platform',
        name: investmentName,
        quantity: 10,
        average_buy_price: 1000,
        current_price: 1200,
        purchase_date: new Date().toISOString(),
      },
    });
    expect(investment.ok()).toBeTruthy();
    investmentId = (await investment.json())?.data?.id ?? null;
  });

  test.afterAll(async ({ request }) => {
    const h = authHeaders(auth);
    for (const [url, id] of [
      ['/transactions/', txId],
      ['/budgets/', budgetId],
      ['/saving-goals/', goalId],
      ['/investments/', investmentId],
      ['/categories/', categoryId],
    ] as const) {
      if (id) {
        await request.delete(`${API_BASE}${url}${id}`, { headers: h }).catch(() => {});
      }
    }
  });

  test('Enter on a transaction result lands on /transactions showing it (any month)', async ({ page }) => {
    await seedAuth(page, auth);
    await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
    const input = page
      .locator('header input[aria-label="Pencarian global"], header input[aria-label="Global search"]')
      .first();
    await expect(input).toBeVisible({ timeout: 20000 });
    await input.click();
    await input.pressSequentially(txNote.slice(0, 18), { delay: 30 });
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 20000 });
    await input.press('Enter');

    await page.waitForURL(/\/transactions\?q=/, { timeout: 20000 });
    await expect(page.getByText(txNote).first()).toBeVisible({ timeout: 20000 });
  });

  test('clicking a transaction result shows it on /transactions (any month)', async ({ page }) => {
    await seedAuth(page, auth);
    await searchAndClickResult(page, txNote.slice(0, 18), GROUPS.transactions);
    await page.waitForURL(/\/transactions\?q=/, { timeout: 20000 });
    await expect(page.getByText(txNote).first()).toBeVisible({ timeout: 20000 });
  });

  test('clicking an account result lands on /accounts', async ({ page }) => {
    // NOTE: per-dashboard currency scoping is intentional (reverted in the
    // r4 rollback) — a cross-currency account may not appear in the list.
    // This only asserts the landing navigation; full search bar will be
    // redesigned into a page-navigation palette.
    await seedAuth(page, auth);
    await searchAndClickResult(page, 'E2E Acc IDR', GROUPS.accounts);
    await page.waitForURL(/\/accounts(\?|$)/, { timeout: 20000 });
    await expect(page.locator('main')).toBeVisible({ timeout: 20000 });
  });

  test('clicking a category result shows it on /categories', async ({ page }) => {
    await seedAuth(page, auth);
    await searchAndClickResult(page, categoryName, GROUPS.categories);
    await page.waitForURL(/\/categories$/, { timeout: 20000 });
    await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 20000 });
  });

  test('clicking a budget result from a past month shows it on /budgets', async ({ page }) => {
    test.skip(!budgetId, 'budget seed unavailable');
    await seedAuth(page, auth);
    await searchAndClickResult(page, categoryName, GROUPS.budgets);
    await page.waitForURL(/\/budgets\?month=\d+&year=\d+$/, { timeout: 20000 });
    await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 20000 });
  });

  test('clicking a saving-goal result shows it on /goals', async ({ page }) => {
    test.skip(!goalId, 'goal seed unavailable');
    await seedAuth(page, auth);
    await searchAndClickResult(page, goalName, GROUPS.savingGoals);
    await page.waitForURL(/\/goals$/, { timeout: 20000 });
    await expect(page.getByText(goalName).first()).toBeVisible({ timeout: 20000 });
  });

  test('clicking an investment result shows it on /investments', async ({ page }) => {
    test.skip(!investmentId, 'investment seed unavailable');
    await seedAuth(page, auth);
    await searchAndClickResult(page, investmentName, GROUPS.investments);
    await page.waitForURL(/\/investments$/, { timeout: 20000 });
    await expect(page.getByText(investmentName).first()).toBeVisible({ timeout: 20000 });
  });

  test('clicking a notification result lands on /notifications', async ({ page }) => {
    const res = await page.request.get(API_BASE + '/notifications?limit=10', {
      headers: authHeaders(auth),
    });
    const body = await res.json().catch(() => null);
    const items = body?.data?.items ?? body?.items ?? body?.data ?? [];
    test.skip(!Array.isArray(items) || items.length === 0, 'no notifications seeded');
    const title: string = items[0]?.title ?? '';
    test.skip(!title || title.length < 2, 'notification title unavailable');

    await seedAuth(page, auth);
    await searchAndClickResult(page, title, GROUPS.notifications);
    await page.waitForURL(/\/notifications$/, { timeout: 20000 });
    // NOTE: list is currency-scoped by design (r4 rollback) — the clicked
    // notification may not be visible if its currency differs from the
    // active dashboard currency. Assert landing only.
    await expect(page.locator('main')).toBeVisible({ timeout: 20000 });
  });

  test('clicking an insight result lands on /analytics with a matching period', async ({ page }) => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
    const toInput = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const res = await page.request.get(
      `${API_BASE}/analytics/insights?startDate=${toInput(start)}&endDate=${toInput(end)}`,
      { headers: authHeaders(auth) },
    );
    const body = await res.json().catch(() => null);
    const insights: string[] = Array.isArray(body?.data) ? body.data : [];
    test.skip(insights.length === 0, 'no insights available');
    const sentence: string = insights[0];
    const term = sentence.slice(0, 12);

    await seedAuth(page, auth);
    await searchAndClickResult(page, term, GROUPS.insights);
    await page.waitForURL(/\/analytics\?period=thisYear$/, { timeout: 20000 });
    await expect(page.locator('main, body').first()).toBeVisible({ timeout: 20000 });
  });
});
