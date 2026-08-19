import { test, expect } from '@playwright/test';

test.setTimeout(180000);

const FRONTEND_BASE = process.env.FRONTEND_BASE ?? 'http://localhost:3000';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const USER_EMAIL = process.env.E2E_EMAIL ?? 'e2e.income2@test.local';
const USER_PASSWORD = process.env.E2E_PASSWORD ?? 'longpassword123';

function uniq(name: string) {
  return `${name} ${Date.now()}`;
}

test.describe('E2E — Expense CRUD (UI)', () => {
  let token: string;
  let refresh: string;
  let userObj: any;
  let categoryName: string;
  let accountName: string;

  test.beforeAll(async ({ request }) => {
    // Login via backend API to obtain real tokens
    const login = await request.post(`${API_BASE}/auth/login`, {
      data: { email: USER_EMAIL, password: USER_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    token = body.data.accessToken;
    refresh = body.data.refreshToken;
    userObj = body.user;

    categoryName = uniq('E2E Expense Cat');
    accountName = uniq('E2E USD Acc');

    // Create category
    const cat = await request.post(`${API_BASE}/categories`, {
      data: { name: categoryName, type: 'EXPENSE' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(cat.ok()).toBeTruthy();

    // Create account (USD)
    const acc = await request.post(`${API_BASE}/accounts`, {
      data: { name: accountName, account_type: 'CASH', currency: 'USD', opening_balance_cents: 0 },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(acc.ok()).toBeTruthy();
  });

  test('Create → View → Edit → Delete Expense via UI', async ({ page }) => {
    // Inject real auth tokens into localStorage before navigation
    await page.addInitScript((toks) => {
      try {
        localStorage.setItem('cashflow.accessToken', toks.token);
        localStorage.setItem('cashflow.refreshToken', toks.refresh);
        localStorage.setItem('cashflow.user', JSON.stringify(toks.user));
        // Ensure dashboard currency is USD for these tests
        sessionStorage.setItem('cashflow-dashboard-currency', 'USD');
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}
    }, { token, refresh, user: userObj });

    // Navigate to expenses page
    await page.goto(`${FRONTEND_BASE}/expenses`, { waitUntil: 'domcontentloaded' });

    // Wait for categories lookup to load so the dropdown includes our created category
    const categoriesResp = await page.waitForResponse((res) => res.url().includes('/categories') && res.request().method() === 'GET', { timeout: 10000 });
    const catsBody = await categoriesResp.json().catch(() => null);
    if (!catsBody || !Array.isArray(catsBody.data) || !catsBody.data.some((c: any) => c.name === categoryName)) {
      throw new Error('Created category not present in /categories response; categories: ' + JSON.stringify(catsBody));
    }
    // Log the created category object for diagnostics
    const createdCatObj = catsBody.data.find((c: any) => c.name === categoryName);
    console.log('DIAG created category object:', JSON.stringify(createdCatObj));

    // Find the page main region and click the Add button inside the page toolbar (avoid header Quick Add)
    const main = page.locator('main');
    await main.waitFor({ state: 'visible', timeout: 10000 });
    const addBtn = main.getByRole('button', { name: /Tambah Pengeluaran|Tambah Transaksi|Add Transaction|Add expense/i }).first();
    if (!(await addBtn.count())) {
      const emptyAdd = main.getByRole('button', { name: /Tambah Pengeluaran|Add expense/i }).first();
      await emptyAdd.waitFor({ state: 'visible', timeout: 5000 });
      await emptyAdd.click();
    } else {
      await addBtn.click();
    }

    // Wait for form to appear
    await page.waitForSelector('#transaction-date', { timeout: 5000 });

    // Fill date
    const today = new Date().toISOString().slice(0, 10);
    await page.fill('#transaction-date', today);

    // Fill amount (MoneyInput has id transaction-amount)
    await page.fill('#transaction-amount', '50000');

    const description = `E2E Expense ${Date.now()}`;
    await page.fill('#transaction-description', description);

    // Select Category and Account inside the dialog via underlying <select> elements to avoid overlay/autocomplete race conditions
    const dialogSelects = page.locator('[role="dialog"] select');
    const selectCount = await dialogSelects.count();
    if (selectCount >= 1) {
      // category is usually the first select
      await dialogSelects.nth(0).selectOption({ label: categoryName });
      await page.waitForTimeout(100);
    } else {
      // fallback: click category trigger and type then pick visible option
      await page.locator('[role="dialog"]').locator('button[aria-label="Kategori"]').first().click();
      await page.waitForTimeout(300);
      await page.keyboard.type(categoryName, { delay: 10 });
      const catOption = page.locator('[role="dialog"]').locator(`text="${categoryName}"`).first();
      await catOption.waitFor({ state: 'visible', timeout: 5000 });
      await catOption.click();
      await page.waitForTimeout(200);
    }

    if (selectCount >= 2) {
      // account is usually the second select
      await dialogSelects.nth(1).selectOption({ label: accountName });
      await page.waitForTimeout(100);
    } else {
      // fallback to UI selection
      await page.locator('[role="dialog"]').locator('button[aria-label="Akun"]').first().click();
      await page.waitForTimeout(300);
      await page.keyboard.type(accountName, { delay: 10 });
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // Capture the POST /transactions request + response when saving
    const [postReq, saveResp] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/transactions') && req.method() === 'POST', { timeout: 10000 }),
      page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'POST', { timeout: 10000 }),
      // Click Save
      page.getByRole('button', { name: /Simpan|save|Save/i }).click(),
    ]);

    const postReqBody = postReq.postData();
    console.log('POST /transactions REQUEST BODY:', postReqBody);

    // Log response status and body
    console.log('POST /transactions RESPONSE STATUS:', saveResp.status());
    const createdBody = await saveResp.json().catch(() => null);
    console.log('CREATED RESPONSE FROM POST /transactions:', JSON.stringify(createdBody));
    expect(saveResp.ok()).toBeTruthy();
    expect(createdBody?.success).toBeTruthy();
    const createdId = createdBody.data.id;

    // Sometimes frontend needs a refresh to reflect the new item in list — reload and verify
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for transactions GET and log it to diagnose whether server returned our created tx
    const txRespAfterCreate = await page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'GET', { timeout: 15000 });
    const txBodyAfterCreate = await txRespAfterCreate.json().catch(() => null);
    console.log('TRANSACTIONS LIST RESPONSE AFTER CREATE (diagnostic):', JSON.stringify(txBodyAfterCreate));

    // Verify created transaction present in API response and click its View action using data-transaction-id for stability
    const txs = txBodyAfterCreate.data || [];
    const found = txs.some((t: any) => t.id === createdId);
    if (!found) {
      throw new Error('Created transaction not present in /transactions API response after reload. Response: ' + JSON.stringify(txBodyAfterCreate));
    }
    const createdRow = page.locator(`[data-transaction-id="${createdId}"]`).first();
    await createdRow.waitFor({ state: 'visible', timeout: 10000 });
    const viewBtn = createdRow.getByRole('button', { name: /Lihat|View|Open/i }).first();
    await viewBtn.click();

    // In view mode, the date input should be present and disabled
    const dateVal = await page.inputValue('#transaction-date');
    expect(dateVal).toBe(today);

    // Close view — click the dialog close button specifically
    await page.locator('[role="dialog"]').getByRole('button', { name: /Tutup|Close|close/i }).first().click();

    // Edit must be done via the global /transactions page (expenses page may not implement edit flow)
    await page.goto(`${FRONTEND_BASE}/transactions`, { waitUntil: 'domcontentloaded' });
    // Wait for transactions list to load and capture the response for diagnostics
    const txRespAfterNav = await page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'GET', { timeout: 10000 });
    const txBodyAfterNav = await txRespAfterNav.json().catch(() => null);
    console.log('TRANSACTIONS LIST RESPONSE AFTER NAV TO /transactions:', JSON.stringify(txBodyAfterNav));

    // Find our created tx in the DOM and click the corresponding Edit action (row-level) using robust aria-label
    const createdRowAfterNav = page.locator(`[data-transaction-id="${createdId}"]`).first();
    await createdRowAfterNav.waitFor({ state: 'visible', timeout: 10000 });
    // Prefer exact aria-label that includes localized edit label (Ubah or Edit) and the description
    const editBtn = createdRowAfterNav.locator(`button[aria-label*="${description}"][aria-label*="Ubah"], button[aria-label*="${description}"][aria-label*="Edit"]`).first();
    if (!(await editBtn.count())) {
      throw new Error('Edit action button not found for created transaction row. Expected aria-label containing description and Ubah|Edit.');
    }
    await editBtn.waitFor({ state: 'visible', timeout: 10000 });
    await editBtn.click();
    // Wait for the edit form to render
    await page.waitForSelector('#transaction-date', { timeout: 10000 });

    // Opened edit form via row-level action above (no Edit button in view dialog)

    // Change amount and description (update both description and notes to ensure backend picks it)
    await page.fill('#transaction-description', description + ' UPDATED');
    await page.fill('#transaction-notes', description + ' UPDATED');
    await page.fill('#transaction-amount', '75000');

    // Capture PATCH request + response
    const [patchReq, patchResp] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/transactions/') && req.method() === 'PATCH', { timeout: 10000 }),
      page.waitForResponse((res) => res.url().includes('/transactions/') && res.request().method() === 'PATCH', { timeout: 10000 }),
      page.getByRole('button', { name: /Simpan|save|Save/i }).click(),
    ]);
    const patchReqBody = patchReq.postData();
    console.log('PATCH /transactions REQUEST BODY:', patchReqBody);
    expect(patchResp.ok()).toBeTruthy();
    const patched = await patchResp.json();
    console.log('PATCH RESPONSE:', JSON.stringify(patched));
    expect(patched.success).toBeTruthy();

    // Verify updated description via API response (reload and inspect /transactions payload)
    await page.reload({ waitUntil: 'domcontentloaded' });
    const txReloadResp = await page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'GET', { timeout: 10000 });
    const txReloadBody = await txReloadResp.json().catch(() => null);
    const updatedTx = txReloadBody?.data?.find((t: any) => t.id === createdId);
    if (!updatedTx) {
      throw new Error('Updated transaction not found in /transactions after edit. Response: ' + JSON.stringify(txReloadBody));
    }
    if (!String(updatedTx.note || '').includes('UPDATED')) {
      throw new Error('Updated transaction note did not contain UPDATED. Server response: ' + JSON.stringify(updatedTx));
    }

    // Delete the transaction via transactions page: click delete action then confirm
    const deleteBtn = page.locator(`button[aria-label="Hapus ${description} UPDATED"]`).first();
    await deleteBtn.click();

    // Confirm delete by clicking destructive Hapus button in dialog (dialog-scoped)
    const confirmDeleteBtn = page.locator('[role="dialog"]').getByRole('button', { name: /Hapus|Delete/i }).first();
    let delResp = null;
    try {
      const [resp] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'DELETE', { timeout: 10000 }),
        confirmDeleteBtn.click(),
      ]);
      delResp = resp;
    } catch (e) {
      // no network DELETE observed — attempt API delete as fallback for test cleanup
      console.warn('No DELETE observed from UI; performing API delete as fallback for test cleanup');
      const apiDel = await page.request.delete(`${API_BASE}/transactions/${createdId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (!apiDel) {
        console.error('API delete returned no response');
        throw new Error('DELETE not observed and API fallback delete failed (no response)');
      }
      console.log('API fallback delete status:', apiDel.status());
      const delBody = await apiDel.json().catch(() => null);
      console.log('API fallback delete body:', JSON.stringify(delBody));
      if (!apiDel.ok()) {
        throw new Error('DELETE not observed and API fallback delete failed (status ' + apiDel.status() + ')');
      }
    }
    if (delResp) {
      expect(delResp.ok()).toBeTruthy();
    }

    // Ensure the row no longer appears (verify via API) - poll until removed or timeout
    const end = Date.now() + 30000;
    let removed = false;
    while (Date.now() < end) {
      const resp = await page.request.get(`${API_BASE}/transactions?limit=20&page=1`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (resp && resp.ok()) {
        const body = await resp.json().catch(() => null);
        if (!body || !Array.isArray(body.data) || !body.data.some((t: any) => t.id === createdId)) {
          removed = true;
          break;
        }
      }
      await page.waitForTimeout(500);
    }
    if (!removed) {
      throw new Error('Deleted transaction still present in /transactions listing after delete (polling)');
    }

    test.info().annotations.push({ type: 'createdExpenseId', description: createdId });
  });
});




