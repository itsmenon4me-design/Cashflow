import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API  = process.env.E2E_API_BASE  || 'http://localhost:3001/api/v1';
const EMAIL = process.env.E2E_TEST_EMAIL || 'e2e.api.user@test.local';
const PASS = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

async function loginAndAuth(page: any, request: any) {
  const r = await request.post(API + '/auth/login', { data: { email: EMAIL, password: PASS } });
  const b = await r.json();
  const token = b.data?.accessToken ?? b.accessToken;
  const user = b.user ?? b.data?.user;
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a: any) => {
    localStorage.setItem('cashflow.accessToken', a.token);
    localStorage.setItem('cashflow.user', JSON.stringify(a.user));
  }, { token, user });
  return { token, user };
}

// Targeted measurements at key moments during navigation
test('scrollTop behavior dan content timing saat navigasi', async ({ page, request }) => {
  await loginAndAuth(page, request);

  // 1. Pergi ke transactions (page panjang → bisa scroll)
  await page.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-transaction-id]', { timeout: 15000 });
  await page.waitForTimeout(500);

  // Scroll ke bawah
  await page.evaluate(() => {
    const m = document.querySelector('main')!;
    m.scrollTop = m.scrollHeight;
  });
  const scrollTopBefore = await page.evaluate(() => document.querySelector('main')!.scrollTop);
  const scrollHeightBefore = await page.evaluate(() => document.querySelector('main')!.scrollHeight);
  console.log(`SEBELUM navigasi: scrollTop=${scrollTopBefore}, scrollHeight=${scrollHeightBefore}`);

  // 2. Klik navigasi ke dashboard (page pendek)
  await page.locator('nav a[href="/dashboard"]').first().click();
  await page.waitForURL(/\/dashboard/);

  // Sampel state segera setelah URL berubah (sebelum data settle)
  const postClick = await page.evaluate(() => {
    const m = document.querySelector('main')!;
    return {
      scrollTop: Math.round(m.scrollTop),
      scrollHeight: m.scrollHeight,
      clientHeight: m.clientHeight,
      h1Text: (document.querySelector('main h1') as HTMLElement)?.textContent?.trim() ?? null,
      h1Rect: (() => { const r = document.querySelector('main h1')?.getBoundingClientRect(); return r ? { y: Math.round(r.y), h: Math.round(r.height) } : null })(),
      itemCount: document.querySelectorAll('[data-transaction-id]').length,
    };
  });
  console.log(`SETelah click dashboard: ${JSON.stringify(postClick)}`);

  // Tunggu settle
  await page.locator('main h1').first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  const settled = await page.evaluate(() => {
    const m = document.querySelector('main')!;
    return { scrollTop: Math.round(m.scrollTop), scrollHeight: m.scrollHeight };
  });
  console.log(`SETTLED dashboard: ${JSON.stringify(settled)}`);

  // 3. Navigate back to transactions (page panjang)
  await page.locator('nav a[href="/transactions"]').first().click();
  await page.waitForURL(/\/transactions/);
  const txPostClick = await page.evaluate(() => {
    const m = document.querySelector('main')!;
    return { scrollTop: Math.round(m.scrollTop), scrollHeight: m.scrollHeight };
  });
  console.log(`SETelah click transactions: ${JSON.stringify(txPostClick)}`);

  // Tunggu data load
  await page.waitForSelector('[data-transaction-id]', { timeout: 15000 });
  await page.waitForTimeout(300);
  const txSettled = await page.evaluate(() => {
    const m = document.querySelector('main')!;
    return { scrollTop: Math.round(m.scrollTop), scrollHeight: m.scrollHeight };
  });
  console.log(`SETTLED transactions: ${JSON.stringify(txSettled)}`);

  // 4. Cek apakah scrollPosition dari transactions (awal) persist ke navigate
  // Navigate ke settings (page pendek)
  await page.evaluate(() => {
    const m = document.querySelector('main')!;
    m.scrollTop = 0;
  });
  // Scroll to a known position
  await page.evaluate(() => {
    const m = document.querySelector('main')!;
    m.scrollTop = 200;
  });
  const s200 = await page.evaluate(() => document.querySelector('main')!.scrollTop);
  console.log(`Scroll to 200 → actual=${s200}`);

  await page.locator('nav a[href="/settings"]').first().click();
  await page.waitForURL(/\/settings/);
  const settingsAfter = await page.evaluate(() => {
    const m = document.querySelector('main')!;
    return { scrollTop: Math.round(m.scrollTop), scrollHeight: m.scrollHeight };
  });
  console.log(`Settings AFTER click (no wait): ${JSON.stringify(settingsAfter)}`);
  console.log(`⚠ scrollTop persist: ${settingsAfter.scrollTop > 0 ? 'YES — SCROLL LEAK!' : 'NO — clean reset'}`);
});
