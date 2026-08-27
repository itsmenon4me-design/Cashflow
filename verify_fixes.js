// E2E proof for: profile save, audit-log delete-all, global search.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API = 'http://localhost:3001/api/v1';
const EMAIL = 'admin@cashflow.local';
const PASSWORD = 'admin123';
const OUT = './playwright-traces/fix-evidence';

async function api(method, path, tok, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

(async () => {
  fs.mkdirSync(`${OUT}`, { recursive: true });
  const login = await api('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
  const tok = login.json.data.accessToken;
  console.log('LOGIN', login.status);

  // --- seed minimal data so search has something real to find ---
  const me = await api('GET', '/auth/me', tok);
  const accounts = await api('GET', '/accounts', tok);
  let accountId = accounts.json?.data?.[0]?.id;
  if (!accountId) {
    const acc = await api('POST', '/accounts', tok, { name: 'Bank Buktian', account_type: 'BANK' });
    accountId = acc.json?.data?.id ?? acc.json?.id;
    console.log('SEED account', acc.status, accountId);
  }
  const cats = await api('GET', '/categories', tok);
  const catList = cats.json?.data ?? [];
  const incomeCat = catList.find((c) => c.type === 'INCOME');
  const expenseCat = catList.find((c) => c.type === 'EXPENSE');
  console.log('CATS income=', incomeCat?.name, 'expense=', expenseCat?.name);

  const txList = await api('GET', '/transactions?page=1&limit=1', tok);
  if ((txList.json?.pagination?.totalItems ?? 0) === 0 && accountId && incomeCat && expenseCat) {
    const t1 = await api('POST', '/transactions', tok, {
      account_id: accountId, category_id: incomeCat.id, transaction_type: 'INCOME',
      amount_cents: 5000000, transaction_date: new Date().toISOString(), note: 'Gaji Bulanan Agustus',
    });
    const t2 = await api('POST', '/transactions', tok, {
      account_id: accountId, category_id: expenseCat.id, transaction_type: 'EXPENSE',
      amount_cents: 150000, transaction_date: new Date().toISOString(), note: 'Belanja Mingguan',
    });
    console.log('SEED tx', t1.status, t2.status);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(({ at, rt, me }) => {
    localStorage.setItem('cashflow.accessToken', at);
    localStorage.setItem('cashflow.refreshToken', rt);
    localStorage.setItem('cashflow.language', 'id');
    // real login flow stores a user object — set once, don't clobber on reload
    if (!localStorage.getItem('cashflow.user')) {
      localStorage.setItem('cashflow.user', JSON.stringify({ id: me.id, name: me.full_name || 'admin', email: me.email }));
    }
  }, { at: tok, rt: login.json.data.refreshToken, me: me.json.data });
  const page = await ctx.newPage();
  const result = {};

  // ---------- 1) PROFILE ----------
  const stampName = `Bukti Simpan ${Date.now() % 100000}`;
  await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/profile-before.png` });
  await page.locator('button[aria-label="Ubah"]').first().click();
  await page.fill('#profile-name', stampName);
  await page.locator('button[aria-label="Simpan"]').first().click();
  await page.waitForTimeout(2500);
  const profileError = await page.evaluate(() => document.querySelector('.text-destructive')?.textContent ?? null);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const shownName = await page.evaluate(() => {
    const p = [...document.querySelectorAll('p')].find((el) => el.previousElementSibling === null && el.className.includes('font-medium'));
    return p?.textContent ?? null;
  });
  // more robust: read the <p> right after the Name label
  const shownName2 = await page.evaluate(() => {
    const label = [...document.querySelectorAll('label')].find((l) => /Nama/.test(l.textContent || ''));
    const card = label?.closest('[data-slot=card-content]');
    const ps = card ? [...card.querySelectorAll('p.font-medium')] : [];
    return ps.map((p) => p.textContent).join('|');
  });
  result.profile = { stamped: stampName, shownAfterReload: shownName2 || shownName, inlineError: profileError };
  const meAfter = await api('GET', '/auth/me', tok);
  result.profile.dbFullName = meAfter.json?.data?.full_name;
  result.profile.pass = (shownName2 || '').includes(stampName) || result.profile.dbFullName === stampName;
  await page.screenshot({ path: `${OUT}/profile-after-reload.png` });
  console.log('PROFILE', JSON.stringify(result.profile));

  // ---------- 2) AUDIT LOG ----------
  await page.goto(BASE + '/audit-log', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const beforeCount = await page.evaluate(() => document.querySelectorAll('ul > li').length);
  await page.screenshot({ path: `${OUT}/audit-before.png` });
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
  await page.getByRole('button', { name: /Hapus Semua/i }).click();
  await page.waitForTimeout(3500);
  const afterState = await page.evaluate(() => ({
    rows: document.querySelectorAll('ul > li').length,
    bodyHasEmpty: /Belum ada catatan aktivitas/i.test(document.body.innerText),
    bodyHasLoadError: /Gagal memuat audit log/i.test(document.body.innerText),
    bodyHasDeleteError: /Gagal menghapus audit log/i.test(document.body.innerText),
  }));
  const dbAfter = await api('GET', '/audit-logs/me?page=1&limit=10', tok);
  result.audit = { beforeCount, dialogs, ...afterState, dbTotalAfter: dbAfter.json?.meta?.total ?? dbAfter.json?.meta?.totalItems };
  result.audit.pass = afterState.bodyHasEmpty && !afterState.bodyHasLoadError && !afterState.bodyHasDeleteError;
  await page.screenshot({ path: `${OUT}/audit-after-delete.png` });
  console.log('AUDIT', JSON.stringify(result.audit));

  // ---------- 3) SEARCH ----------
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const searchInput = page.locator('header input[aria-label]').first();
  await searchInput.click();
  await searchInput.fill('Gaji');
  await page.waitForSelector('header [role="listbox"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const optionsGaji = await page.evaluate(() =>
    [...document.querySelectorAll('header [role="option"]')].map((o) => o.textContent.trim().slice(0, 90)),
  );
  await page.screenshot({ path: `${OUT}/search-gaji.png` });

  await searchInput.fill('');
  await searchInput.pressSequentially('Buktian', { delay: 40 });
  await page.waitForTimeout(1800);
  const optionsAccount = await page.evaluate(() =>
    [...document.querySelectorAll('header [role="option"]')].map((o) => o.textContent.trim().slice(0, 90)),
  );
  await page.screenshot({ path: `${OUT}/search-account.png` });

  // click-through navigation check on a category/transaction result
  let navigated = null;
  if (optionsGaji.length > 0) {
    await searchInput.fill('');
    await searchInput.pressSequentially('Gaji', { delay: 40 });
    await page.waitForTimeout(1800);
    const opt = page.locator('header [role="option"]').first();
    if (await opt.count()) {
      await Promise.all([
        page.waitForURL((u) => !String(u).endsWith('/dashboard'), { timeout: 8000 }).catch(() => {}),
        opt.click(),
      ]);
      navigated = page.url();
    }
  }
  result.search = { gaji: optionsGaji, buktian: optionsAccount, navigatedTo: navigated };
  result.search.pass = optionsGaji.length > 0 || optionsAccount.length > 0;
  console.log('SEARCH', JSON.stringify(result.search));

  console.log('\nSUMMARY ' + JSON.stringify({
    profile: result.profile.pass,
    audit: result.audit.pass,
    search: result.search.pass,
  }, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
