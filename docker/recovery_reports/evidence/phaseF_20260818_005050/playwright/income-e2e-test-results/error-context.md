# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright\income-e2e.spec.ts >> E2E — Income CRUD (UI) >> Create → View → Edit → Delete Income via UI
- Location: playwright\income-e2e.spec.ts:50:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.setTimeout(180000);
  4   | 
  5   | const FRONTEND_BASE = process.env.FRONTEND_BASE ?? 'http://localhost:3000';
  6   | const API_BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
  7   | const USER_EMAIL = process.env.E2E_EMAIL ?? 'e2e.income2@test.local';
  8   | const USER_PASSWORD = process.env.E2E_PASSWORD ?? 'longpassword123';
  9   | 
  10  | function uniq(name: string) {
  11  |   return `${name} ${Date.now()}`;
  12  | }
  13  | 
  14  | test.describe('E2E — Income CRUD (UI)', () => {
  15  |   let token: string;
  16  |   let refresh: string;
  17  |   let userObj: any;
  18  |   let categoryName: string;
  19  |   let accountName: string;
  20  | 
  21  |   test.beforeAll(async ({ request }) => {
  22  |     // Login via backend API to obtain real tokens
  23  |     const login = await request.post(`${API_BASE}/auth/login`, {
  24  |       data: { email: USER_EMAIL, password: USER_PASSWORD },
  25  |     });
> 26  |     expect(login.ok()).toBeTruthy();
      |                        ^ Error: expect(received).toBeTruthy()
  27  |     const body = await login.json();
  28  |     token = body.data.accessToken;
  29  |     refresh = body.data.refreshToken;
  30  |     userObj = body.user;
  31  | 
  32  |     categoryName = uniq('E2E Income Cat');
  33  |     accountName = uniq('E2E USD Acc');
  34  | 
  35  |     // Create category
  36  |     const cat = await request.post(`${API_BASE}/categories`, {
  37  |       data: { name: categoryName, type: 'INCOME' },
  38  |       headers: { Authorization: `Bearer ${token}` },
  39  |     });
  40  |     expect(cat.ok()).toBeTruthy();
  41  | 
  42  |     // Create account (USD)
  43  |     const acc = await request.post(`${API_BASE}/accounts`, {
  44  |       data: { name: accountName, account_type: 'CASH', currency: 'USD', opening_balance_cents: 0 },
  45  |       headers: { Authorization: `Bearer ${token}` },
  46  |     });
  47  |     expect(acc.ok()).toBeTruthy();
  48  |   });
  49  | 
  50  |   test('Create → View → Edit → Delete Income via UI', async ({ page }) => {
  51  |     // Inject real auth tokens into localStorage before navigation
  52  |     await page.addInitScript((toks) => {
  53  |       try {
  54  |         localStorage.setItem('cashflow.accessToken', toks.token);
  55  |         localStorage.setItem('cashflow.refreshToken', toks.refresh);
  56  |         localStorage.setItem('cashflow.user', JSON.stringify(toks.user));
  57  |         // Ensure dashboard currency is USD for these tests
  58  |         sessionStorage.setItem('cashflow-dashboard-currency', 'USD');
  59  |         window.dispatchEvent(new Event('storage'));
  60  |       } catch (e) {}
  61  |     }, { token, refresh, user: userObj });
  62  | 
  63  |     // Intercept network for diagnostics and to capture POST/PATCH/DELETE
  64  |     const created: any = { id: null };
  65  | 
  66  |     // Navigate to incomes page
  67  |     await page.goto(`${FRONTEND_BASE}/incomes`, { waitUntil: 'domcontentloaded' });
  68  | 
  69  |     // Wait for categories lookup to load so the dropdown includes our created category
  70  |     const categoriesResp = await page.waitForResponse((res) => res.url().includes('/categories') && res.request().method() === 'GET', { timeout: 10000 });
  71  |     const catsBody = await categoriesResp.json().catch(() => null);
  72  |     if (!catsBody || !Array.isArray(catsBody.data) || !catsBody.data.some((c: any) => c.name === categoryName)) {
  73  |       throw new Error('Created category not present in /categories response; categories: ' + JSON.stringify(catsBody));
  74  |     }
  75  |     // Log the created category object for diagnostics
  76  |     const createdCatObj = catsBody.data.find((c: any) => c.name === categoryName);
  77  |     console.log('DIAG created category object:', JSON.stringify(createdCatObj));
  78  | 
  79  |     // Find the page main region and click the Add button inside the page toolbar (avoid header Quick Add)
  80  |     const main = page.locator('main');
  81  |     await main.waitFor({ state: 'visible', timeout: 10000 });
  82  |     const addBtn = main.getByRole('button', { name: /Tambah Pemasukan|Tambah Transaksi|Add Transaction/i }).first();
  83  |     // fallback: try a more generic transactions add label inside the page
  84  |     if (!(await addBtn.count())) {
  85  |       // try empty-state action button with explicit text
  86  |       const emptyAdd = main.getByRole('button', { name: /Tambah Pemasukan|Add income/i }).first();
  87  |       await emptyAdd.waitFor({ state: 'visible', timeout: 5000 });
  88  |       await emptyAdd.click();
  89  |     } else {
  90  |       await addBtn.click();
  91  |     }
  92  | 
  93  |     // Wait for form to appear
  94  |     await page.waitForSelector('#transaction-date', { timeout: 5000 });
  95  | 
  96  |     // Fill date
  97  |     const today = new Date().toISOString().slice(0, 10);
  98  |     await page.fill('#transaction-date', today);
  99  | 
  100 |     // Fill amount (MoneyInput has id transaction-amount)
  101 |     await page.fill('#transaction-amount', '100000');
  102 | 
  103 |     const description = `E2E Income ${Date.now()}`;
  104 |     await page.fill('#transaction-description', description);
  105 | 
  106 |     // Select Category and Account via underlying <select> if present (more reliable than typeahead overlays)
  107 |     const dialogSelects = page.locator('[role="dialog"] select');
  108 |     const selectCount = await dialogSelects.count();
  109 |     if (selectCount >= 1) {
  110 |       // category is usually the first select
  111 |       await dialogSelects.nth(0).selectOption({ label: categoryName });
  112 |       await page.waitForTimeout(100);
  113 |     } else {
  114 |       // fallback: click category trigger and type then pick visible option
  115 |       await page.locator('[role="dialog"]').locator('button[aria-label="Kategori"]').first().click();
  116 |       await page.waitForTimeout(300);
  117 |       await page.keyboard.type(categoryName, { delay: 10 });
  118 |       const catOption = page.locator('[role="dialog"]').locator(`text="${categoryName}"`).first();
  119 |       await catOption.waitFor({ state: 'visible', timeout: 5000 });
  120 |       await catOption.click();
  121 |       await page.waitForTimeout(200);
  122 |     }
  123 | 
  124 |     if (selectCount >= 2) {
  125 |       // account is usually the second select
  126 |       await dialogSelects.nth(1).selectOption({ label: accountName });
```