import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: "./playwright-tests/storageState.json",
  viewport: { width: 1440, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(`${BASE}/reports`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
console.log("URL:", page.url());
const cards = await page.locator('[data-slot="card"]').count();
console.log("cards:", cards);
const h1 = await page.locator("h1").first().textContent().catch(() => "-");
console.log("h1:", h1?.trim());
console.log("body snippet:", (await page.locator("body").innerText()).slice(0, 400).replace(/\n+/g, " | "));
await browser.close();
