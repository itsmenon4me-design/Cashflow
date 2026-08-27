import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const API = process.env.E2E_API_URL || "http://localhost:3001/api/v1";
const EMAIL = process.env.E2E_TEST_EMAIL || "e2e.api.user@test.local";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "TestPass123!";
const OUT = "screenshots-polish";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const login = await ctx.request.post(`${API}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!login.ok()) {
    throw new Error(`Login failed: ${login.status()} ${await login.text()}`);
  }
  const json = await login.json();
  const d = json.data ?? json;
  const user = JSON.stringify({
    id: d.user?.id ?? null,
    name: d.user?.full_name ?? d.user?.name ?? "E2E",
    email: EMAIL,
  });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([access, refresh, userJson]) => {
      window.localStorage.setItem("cashflow.accessToken", access);
      window.localStorage.setItem("cashflow.refreshToken", refresh);
      window.localStorage.setItem("cashflow.user", userJson);
    },
    [d.accessToken, d.refreshToken, user],
  );
  return page;
}

async function shotCard(page, titleText, path, hoverChart = false) {
  const card = page.locator('[data-slot="card"]', { hasText: titleText }).first();
  await card.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForSelector("svg.recharts-surface", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
  if (hoverChart) {
    const svg = card.locator("svg.recharts-surface").first();
    if (await svg.count()) {
      const box = await svg.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5);
        await page.waitForTimeout(500);
      }
    }
  }
  await card.screenshot({ path });
  console.log("saved", path);
}

try {
  // ---------- Desktop ----------
  const page = await newPage({ width: 1440, height: 1000 });

  await page.goto(`${BASE}/reports`, { waitUntil: "domcontentloaded" });
  await shotCard(page, "Tren Arus Kas", `${OUT}/reports-trend-desktop.png`, true);

  await page.goto(`${BASE}/analytics`, { waitUntil: "domcontentloaded" });
  await shotCard(page, "Komposisi Pengeluaran per Kategori", `${OUT}/analytics-expense-trend.png`);

  await page.goto(`${BASE}/incomes`, { waitUntil: "domcontentloaded" });
  const incomeFilters = page.locator('[data-slot="card"]', { hasText: "Dari tanggal" }).first();
  await incomeFilters.waitFor({ state: "visible", timeout: 60_000 });
  await incomeFilters.screenshot({ path: `${OUT}/incomes-filters-desktop.png` });
  console.log("saved", `${OUT}/incomes-filters-desktop.png`);

  await page.goto(`${BASE}/transactions`, { waitUntil: "domcontentloaded" });
  const txFilters = page.locator('[data-slot="card"]', { hasText: "Dari tanggal" }).first();
  await txFilters.waitFor({ state: "visible", timeout: 60_000 });
  await txFilters.screenshot({ path: `${OUT}/transactions-filters-desktop.png` });
  console.log("saved", `${OUT}/transactions-filters-desktop.png`);
  await page.context().close();

  // ---------- Mobile ----------
  const mob = await newPage({ width: 390, height: 844 });
  await mob.goto(`${BASE}/incomes`, { waitUntil: "domcontentloaded" });
  const incomeFiltersM = mob.locator('[data-slot="card"]', { hasText: "Dari tanggal" }).first();
  await incomeFiltersM.waitFor({ state: "visible", timeout: 60_000 });
  await incomeFiltersM.screenshot({ path: `${OUT}/incomes-filters-mobile.png` });
  console.log("saved", `${OUT}/incomes-filters-mobile.png`);
  await mob.context().close();

  // ---------- Small-data trend state ----------
  const small = await newPage({ width: 1440, height: 1000 });
  // Custom range far in the past (before any seeded data) -> <3 buckets.
  await small.goto(
    `${BASE}/reports`,
    { waitUntil: "domcontentloaded" },
  );
  const startInput = small.locator("#report-start");
  await startInput.waitFor({ state: "visible", timeout: 60_000 });
  await startInput.fill("2020-01-01");
  await small.locator("#report-end").fill("2020-01-20");
  await small.getByRole("button", { name: /Terapkan|Apply/i }).click();
  await shotCard(small, "Tren Arus Kas", `${OUT}/reports-trend-small-data.png`);
  await small.context().close();
} finally {
  await browser.close();
}
