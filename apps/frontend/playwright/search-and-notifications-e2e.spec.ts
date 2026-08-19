import { test, expect } from '@playwright/test';

// E2E evidence for:
//  - Bug #9: header global search must land on /transactions?q=<term> and the
//    list must be filtered by that query (previously the topbar/header search
//    and the income/expense page search were dead).
//  - Bug #6: notifications "Hapus Semua" (clear all) must remove every
//    notification via DELETE /notifications and update the UI + store.

test.setTimeout(180000);

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3101/api/v1';
const USER_EMAIL = process.env.E2E_EMAIL ?? 'e2e.api.user@test.local';
const USER_PASSWORD = process.env.E2E_PASSWORD ?? 'TestPass123!';

async function login(request: any) {
  const res = await request.post(API_BASE + '/auth/login', {
    data: { email: USER_EMAIL, password: USER_PASSWORD },
  });
  expect(res.ok(), `login as ${USER_EMAIL} must succeed`).toBeTruthy();
  const body = await res.json();
  const data = body?.data ?? body;
  expect(data?.accessToken, 'login must return accessToken').toBeTruthy();
  return { token: data.accessToken, refresh: data.refreshToken, user: body?.user ?? data?.user };
}

async function seedAuth(page: any, auth: any) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a) => {
    try {
      localStorage.setItem('cashflow.accessToken', a.token);
      localStorage.setItem('cashflow.refreshToken', a.refresh);
      localStorage.setItem('cashflow.user', JSON.stringify(a.user));
      localStorage.setItem('cashflow-dashboard-currency', 'IDR');
      sessionStorage.removeItem('cashflow-dashboard-currency');
    } catch (e) {
      // ignore
    }
  }, auth);
}

test.describe('Bug #9 + #6 E2E (search wiring & notifications clear-all)', () => {
  let auth: { token: string; refresh: string; user: any };
  const seededTxIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    auth = await login(request);
  });

  async function seedTx(request: any, amountCents: number, note: string) {
    const categories = await request.get(API_BASE + '/categories', {
      headers: { Authorization: 'Bearer ' + auth.token },
    });
    const catBody = await categories.json();
    const expenseCat = (catBody?.data ?? []).find((c: any) => c.type === 'EXPENSE') ?? (catBody?.data ?? [])[0];
    expect(expenseCat, 'fixture user must have a category').toBeTruthy();

    const accounts = await request.get(API_BASE + '/accounts?currency=IDR', {
      headers: { Authorization: 'Bearer ' + auth.token },
    });
    const accBody = await accounts.json();
    const idrAcc = (accBody?.data ?? []).find((a: any) => a.currency === 'IDR');
    expect(idrAcc, 'fixture user must have an IDR account').toBeTruthy();

    const tx = await request.post(API_BASE + '/transactions', {
      headers: { Authorization: 'Bearer ' + auth.token },
      data: {
        account_id: idrAcc.id,
        category_id: expenseCat.id,
        transaction_type: 'EXPENSE',
        amount_cents: amountCents,
        transaction_date: '2026-08-18',
        note,
        reference_number: crypto.randomUUID(),
      },
    });
    expect(tx.ok(), 'transaction create must succeed').toBeTruthy();
    const txBody = await tx.json();
    const txId = txBody?.data?.id;
    expect(txId, 'transaction create must return an id').toBeTruthy();
    seededTxIds.push(txId);
    return txId;
  }

  test('#9 header search navigates to /transactions?q= and filters the list', async ({ page, request }) => {
    await seedTx(request, 424242, 'E2E search target');
    await seedAuth(page, auth);

    await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('header');

    // capture the refetch that the q param effect triggers AFTER router.push
    const listResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/transactions') &&
        res.url().includes('q=424242') &&
        res.request().method() === 'GET',
      { timeout: 20000 },
    );

    const searchInput = page.locator('header input[aria-label="Pencarian global"], header input[aria-label="Global search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill('424242');
    await searchInput.press('Enter');

    // the header submit must route to /transactions?q=...
    await page.waitForURL(/\/transactions\?q=424242/, { timeout: 15000 });
    expect(page.url()).toContain('q=424242');

    // the list request must carry the q param and return only the matching row
    const resp = await listResponse;
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    const totalItems = body?.pagination?.totalItems ?? (Array.isArray(body?.data) ? body.data.length : null);
    expect(totalItems, 'search q=424242 must return exactly 1 transaction').toBe(1);
    expect(Number(body.data[0].amount_cents)).toBe(424242);

    // UI must render that single row
    await page.waitForSelector('[data-transaction-id]:visible', { timeout: 15000 });
    const uiCount = await page.locator('[data-transaction-id]:visible').count();
    expect(uiCount).toBe(1);
    console.log(`#9 search q=424242 -> url=${page.url()} api_total=${totalItems} ui_rows=${uiCount}`);
  });

  test('#6 notifications "Hapus Semua" clears the whole list (UI + API)', async ({ page, request }) => {
    // seed a notification via a real transaction create (backend fires a
    // TRANSACTION notification for the user)
    await seedTx(request, 11111, 'E2E clear-all seed');

    // the backend must have created a notification for the user
    await page.waitForTimeout(1500);
    const before = await request.get(API_BASE + '/notifications', {
      headers: { Authorization: 'Bearer ' + auth.token },
    });
    expect(before.ok()).toBeTruthy();
    const beforeBody = await before.json();
    const beforeCount = beforeBody?.pagination?.totalItems ?? (Array.isArray(beforeBody?.data) ? beforeBody.data.length : 0);
    expect(beforeCount, 'at least one notification must exist before clear-all').toBeGreaterThan(0);
    console.log(`#6 notifications before clear-all: ${beforeCount}`);

    await seedAuth(page, auth);
    await page.goto(BASE + '/notifications', { waitUntil: 'domcontentloaded' });

    const clearButton = page.getByRole('button', { name: /Hapus Semua|Clear all/ });
    await expect(clearButton).toBeEnabled({ timeout: 15000 });

    const clearResponse = page.waitForResponse(
      (res) => res.url().includes('/api/v1/notifications') && res.request().method() === 'DELETE',
      { timeout: 15000 },
    );
    await clearButton.click();
    const clearRes = await clearResponse;
    expect(clearRes.ok(), 'DELETE /notifications must succeed').toBeTruthy();

    // UI must show the empty state
    await expect(page.getByText('Belum ada notifikasi.')).toBeVisible({ timeout: 15000 });

    // API must now return an empty list
    const after = await request.get(API_BASE + '/notifications', {
      headers: { Authorization: 'Bearer ' + auth.token },
    });
    const afterBody = await after.json();
    const afterCount = afterBody?.pagination?.totalItems ?? (Array.isArray(afterBody?.data) ? afterBody.data.length : 0);
    expect(afterCount, 'notifications must be empty after clear-all').toBe(0);
    console.log(`#6 notifications after clear-all: ${afterCount}`);
  });

  test.afterAll(async ({ request }) => {
    for (const id of seededTxIds) {
      try {
        await request.delete(API_BASE + '/transactions/' + id, {
          headers: { Authorization: 'Bearer ' + auth.token },
        });
      } catch (e) {
        // ignore cleanup errors
      }
    }
  });
});
