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
  if (!login.ok()) throw new Error(`Login failed: ${login.status()}`);
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
  // Analytics re-capture after "-"-category + YAxis-width polish.
  const page = await newPage({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/analytics`, { waitUntil: "domcontentloaded" });
  await shotCard(page, "Komposisi Pengeluaran per Kategori", `${OUT}/analytics-expense-trend.png`);
  await page.context().close();

  // Small-data state: a narrow window that catches only 1-2 data points
  // (first seeded transactions start on 2026-08-05).
  const small = await newPage({ width: 1440, height: 1000 });
  await small.goto(`${BASE}/reports`, { waitUntil: "domcontentloaded" });
  // Custom date inputs only render when the period select = "Kustom".
  await small.locator("#report-period-select").waitFor({ state: "visible", timeout: 60_000 });
  await small.locator("#report-period-select").click();
  await small.getByRole("option", { name: /Kustom|Custom/i }).click();
  await small.locator("#report-start").waitFor({ state: "visible", timeout: 30_000 });
  await small.locator("#report-start").fill("2026-08-04");
  await small.locator("#report-end").fill("2026-08-06");
  await small.getByRole("button", { name: /Terapkan|Apply/i }).click();
  await shotCard(small, "Tren Arus Kas", `${OUT}/reports-trend-small-data.png`);
  await small.context().close();
} finally {
  await browser.close();
}
