# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps\frontend\playwright\expense-e2e.spec.ts >> E2E — Expense CRUD (UI) >> Create → View → Edit → Delete Expense via UI
- Location: apps\frontend\playwright\expense-e2e.spec.ts:50:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('#transaction-date') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - alert [ref=f3e3]:
    - paragraph [ref=f3e4]: "404"
    - generic [ref=f3e9]:
      - heading "Halaman tidak ditemukan." [level=1] [ref=f3e10]
      - paragraph [ref=f3e11]: Halaman yang Anda cari mungkin telah dipindahkan atau tidak tersedia.
    - link "Kembali ke Beranda" [ref=f3e12] [cursor=pointer]:
      - /url: /
  - status [ref=f3e13]:
    - generic [ref=f3e21]: Anda sedang offline.
    - generic [ref=f3e22]: Data mungkin tidak terbaru. Periksa koneksi internet Anda.
  - alert [ref=f3e23]
```

# Test source

```ts
  96  |     await page.fill('#transaction-amount', '50000');
  97  | 
  98  |     const description = `E2E Expense ${Date.now()}`;
  99  |     await page.fill('#transaction-description', description);
  100 | 
  101 |     // Select Category and Account inside the dialog via underlying <select> elements to avoid overlay/autocomplete race conditions
  102 |     const dialogSelects = page.locator('[role="dialog"] select');
  103 |     const selectCount = await dialogSelects.count();
  104 |     if (selectCount >= 1) {
  105 |       // category is usually the first select
  106 |       await dialogSelects.nth(0).selectOption({ label: categoryName });
  107 |       await page.waitForTimeout(100);
  108 |     } else {
  109 |       // fallback: click category trigger and type then pick visible option
  110 |       await page.locator('[role="dialog"]').locator('button[aria-label="Kategori"]').first().click();
  111 |       await page.waitForTimeout(300);
  112 |       await page.keyboard.type(categoryName, { delay: 10 });
  113 |       const catOption = page.locator('[role="dialog"]').locator(`text="${categoryName}"`).first();
  114 |       await catOption.waitFor({ state: 'visible', timeout: 5000 });
  115 |       await catOption.click();
  116 |       await page.waitForTimeout(200);
  117 |     }
  118 | 
  119 |     if (selectCount >= 2) {
  120 |       // account is usually the second select
  121 |       await dialogSelects.nth(1).selectOption({ label: accountName });
  122 |       await page.waitForTimeout(100);
  123 |     } else {
  124 |       // fallback to UI selection
  125 |       await page.locator('[role="dialog"]').locator('button[aria-label="Akun"]').first().click();
  126 |       await page.waitForTimeout(300);
  127 |       await page.keyboard.type(accountName, { delay: 10 });
  128 |       await page.keyboard.press('Enter');
  129 |       await page.keyboard.press('Escape');
  130 |       await page.waitForTimeout(200);
  131 |     }
  132 | 
  133 |     // Capture the POST /transactions request + response when saving
  134 |     const [postReq, saveResp] = await Promise.all([
  135 |       page.waitForRequest((req) => req.url().includes('/transactions') && req.method() === 'POST', { timeout: 10000 }),
  136 |       page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'POST', { timeout: 10000 }),
  137 |       // Click Save
  138 |       page.getByRole('button', { name: /Simpan|save|Save/i }).click(),
  139 |     ]);
  140 | 
  141 |     const postReqBody = postReq.postData();
  142 |     console.log('POST /transactions REQUEST BODY:', postReqBody);
  143 | 
  144 |     // Log response status and body
  145 |     console.log('POST /transactions RESPONSE STATUS:', saveResp.status());
  146 |     const createdBody = await saveResp.json().catch(() => null);
  147 |     console.log('CREATED RESPONSE FROM POST /transactions:', JSON.stringify(createdBody));
  148 |     expect(saveResp.ok()).toBeTruthy();
  149 |     expect(createdBody?.success).toBeTruthy();
  150 |     const createdId = createdBody.data.id;
  151 | 
  152 |     // Sometimes frontend needs a refresh to reflect the new item in list — reload and verify
  153 |     await page.reload({ waitUntil: 'domcontentloaded' });
  154 | 
  155 |     // Wait for transactions GET and log it to diagnose whether server returned our created tx
  156 |     const txRespAfterCreate = await page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'GET', { timeout: 15000 });
  157 |     const txBodyAfterCreate = await txRespAfterCreate.json().catch(() => null);
  158 |     console.log('TRANSACTIONS LIST RESPONSE AFTER CREATE (diagnostic):', JSON.stringify(txBodyAfterCreate));
  159 | 
  160 |     // Verify created transaction present in API response and click its View action using data-transaction-id for stability
  161 |     const txs = txBodyAfterCreate.data || [];
  162 |     const found = txs.some((t: any) => t.id === createdId);
  163 |     if (!found) {
  164 |       throw new Error('Created transaction not present in /transactions API response after reload. Response: ' + JSON.stringify(txBodyAfterCreate));
  165 |     }
  166 |     const createdRow = page.locator(`[data-transaction-id="${createdId}"]`).first();
  167 |     await createdRow.waitFor({ state: 'visible', timeout: 10000 });
  168 |     const viewBtn = createdRow.getByRole('button', { name: /Lihat|View|Open/i }).first();
  169 |     await viewBtn.click();
  170 | 
  171 |     // In view mode, the date input should be present and disabled
  172 |     const dateVal = await page.inputValue('#transaction-date');
  173 |     expect(dateVal).toBe(today);
  174 | 
  175 |     // Close view — click the dialog close button specifically
  176 |     await page.locator('[role="dialog"]').getByRole('button', { name: /Tutup|Close|close/i }).first().click();
  177 | 
  178 |     // Edit must be done via the global /transactions page (expenses page may not implement edit flow)
  179 |     await page.goto(`${FRONTEND_BASE}/transactions`, { waitUntil: 'domcontentloaded' });
  180 |     // Wait for transactions list to load and capture the response for diagnostics
  181 |     const txRespAfterNav = await page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'GET', { timeout: 10000 });
  182 |     const txBodyAfterNav = await txRespAfterNav.json().catch(() => null);
  183 |     console.log('TRANSACTIONS LIST RESPONSE AFTER NAV TO /transactions:', JSON.stringify(txBodyAfterNav));
  184 | 
  185 |     // Find our created tx in the DOM and click the corresponding Edit action (row-level)
  186 |     const createdRowAfterNav = page.locator(`[data-transaction-id="${createdId}"]`).first();
  187 |     try {
  188 |       await createdRowAfterNav.waitFor({ state: 'visible', timeout: 5000 });
  189 |       const actionButtons = createdRowAfterNav.locator(`button[aria-label*="${description}"]`);
  190 |       await actionButtons.waitFor({ state: 'visible', timeout: 5000 });
  191 |       // action buttons order: View(0), Edit(1), Duplicate(2), Delete(3)
  192 |       await actionButtons.nth(1).click(); // click Edit
  193 |     } catch (e) {
  194 |       // fallback: navigate to edit route
  195 |       await page.goto(`${FRONTEND_BASE}/transactions/${createdId}/edit`, { waitUntil: 'domcontentloaded' });
> 196 |       await page.waitForSelector('#transaction-date', { timeout: 5000 });
      |                  ^ TimeoutError: page.waitForSelector: Timeout 5000ms exceeded.
  197 |     }
  198 | 
  199 |     // Opened edit form via row-level action above (no Edit button in view dialog)
  200 | 
  201 |     // Change amount and description (update both description and notes to ensure backend picks it)
  202 |     await page.fill('#transaction-description', description + ' UPDATED');
  203 |     await page.fill('#transaction-notes', description + ' UPDATED');
  204 |     await page.fill('#transaction-amount', '75000');
  205 | 
  206 |     // Capture PATCH request + response
  207 |     const [patchReq, patchResp] = await Promise.all([
  208 |       page.waitForRequest((req) => req.url().includes('/transactions/') && req.method() === 'PATCH', { timeout: 10000 }),
  209 |       page.waitForResponse((res) => res.url().includes('/transactions/') && res.request().method() === 'PATCH', { timeout: 10000 }),
  210 |       page.getByRole('button', { name: /Simpan|save|Save/i }).click(),
  211 |     ]);
  212 |     const patchReqBody = patchReq.postData();
  213 |     console.log('PATCH /transactions REQUEST BODY:', patchReqBody);
  214 |     expect(patchResp.ok()).toBeTruthy();
  215 |     const patched = await patchResp.json();
  216 |     console.log('PATCH RESPONSE:', JSON.stringify(patched));
  217 |     expect(patched.success).toBeTruthy();
  218 | 
  219 |     // Verify updated description via API response (reload and inspect /transactions payload)
  220 |     await page.reload({ waitUntil: 'domcontentloaded' });
  221 |     const txReloadResp = await page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'GET', { timeout: 10000 });
  222 |     const txReloadBody = await txReloadResp.json().catch(() => null);
  223 |     const updatedTx = txReloadBody?.data?.find((t: any) => t.id === createdId);
  224 |     if (!updatedTx) {
  225 |       throw new Error('Updated transaction not found in /transactions after edit. Response: ' + JSON.stringify(txReloadBody));
  226 |     }
  227 |     if (!String(updatedTx.note || '').includes('UPDATED')) {
  228 |       throw new Error('Updated transaction note did not contain UPDATED. Server response: ' + JSON.stringify(updatedTx));
  229 |     }
  230 | 
  231 |     // Delete the transaction via transactions page: click delete action then confirm
  232 |     const deleteBtn = page.locator(`button[aria-label="Hapus ${description} UPDATED"]`).first();
  233 |     await deleteBtn.click();
  234 | 
  235 |     // Confirm delete by clicking destructive Hapus button in dialog (dialog-scoped)
  236 |     const confirmDeleteBtn = page.locator('[role="dialog"]').getByRole('button', { name: /Hapus|Delete/i }).first();
  237 |     const [delResp] = await Promise.all([
  238 |       page.waitForResponse((res) => res.url().includes('/transactions/') && res.request().method() === 'DELETE', { timeout: 10000 }),
  239 |       confirmDeleteBtn.click(),
  240 |     ]);
  241 |     expect(delResp.ok()).toBeTruthy();
  242 | 
  243 |     // Ensure the row no longer appears (verify via API)
  244 |     const txAfterDelResp = await page.waitForResponse((res) => res.url().includes('/transactions') && res.request().method() === 'GET', { timeout: 10000 });
  245 |     const txAfterDelBody = await txAfterDelResp.json().catch(() => null);
  246 |     if (txAfterDelBody?.data?.some((t: any) => t.id === createdId)) {
  247 |       throw new Error('Deleted transaction still present in /transactions listing after delete. Response: ' + JSON.stringify(txAfterDelBody));
  248 |     }
  249 | 
  250 |     test.info().annotations.push({ type: 'createdExpenseId', description: createdId });
  251 |   });
  252 | });
  253 | 
  254 | 
```