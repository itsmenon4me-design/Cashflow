// Measure layout shift: menu navigation & header dropdowns
const { chromium } = require("playwright");

(async () => {
  const base = "http://localhost:3000";

  const browser = await chromium.launch();
  const ctxOptions = { viewport: { width: 1440, height: 900 } };
  const fs = require('fs');
  const storagePath = 'playwright-tests/storageState.json';
  if (fs.existsSync(storagePath)) {
    ctxOptions.storageState = storagePath;
  } else {
    console.warn('storage state not found, running without authentication');
  }
  const ctx = await browser.newContext(ctxOptions);
  const page = await ctx.newPage();

  await page.goto(base + "/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("header", { timeout: 15000 });
  console.log("URL:", page.url());
  if (page.url().includes("/login")) {
    console.log("FATAL: storage state invalid/expired, redirected to login");
    await browser.close();
    process.exit(1);
  }

  const rectOf = async (sel) =>
    page.$eval(sel, (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
    });

  const snapAll = async () => ({
    header: await rectOf("header"),
    main: await rectOf("main"),
  });

  const same = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  const bodyPad = async () => await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingRight) || 0);

  // ---- TEST 1: main content rect per page (min-h fix) ----
  const pages = ["/dashboard", "/transactions", "/accounts", "/budgets", "/profile"];
  console.log("\n== TEST 1: main content rect per page ==");
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForSelector("main", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    try {
      const r = await rectOf("main");
      console.log(`${p}: y=${r.y} h=${r.h} w=${r.w}`);
    } catch {
      console.log(`${p}: <main> not found (url=${page.url()})`);
    }
  }

  // ---- TEST 2: header element positions while dropdowns open ----
  console.log("\n== TEST 2: header shift when dropdown opens ==");
  await page.goto(base + "/dashboard", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForSelector("header", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Notifications dropdown
  const bell = await page.$('header button[aria-label*="notification" i]');
  if (bell) {
    const before = await snapAll();
    console.log("BEFORE(notif):", JSON.stringify(before), "bodyPad=" + await bodyPad());
    await bell.click();
    await page.waitForTimeout(600);
    const during = await snapAll();
    console.log("DURING(notif):", JSON.stringify(during), "bodyPad=" + await bodyPad());
    console.log("header identical:", same(before.header, during.header));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } else {
    console.log("bell button not found in header");
  }

  // Currency select
  const trig = await page.$('[data-slot="select-trigger"]');
  if (trig) {
    const b2 = await snapAll();
    console.log("BEFORE(currency):", JSON.stringify(b2), "bodyPad=" + await bodyPad());
    await trig.click();
    await page.waitForTimeout(600);
    const d2 = await snapAll();
    console.log("DURING(currency):", JSON.stringify(d2), "bodyPad=" + await bodyPad());
    console.log("header identical:", same(b2.header, d2.header));
    const itemCount = await page.locator('[data-slot="select-item"]').count();
    console.log("currency item count:", itemCount);
    const scrollState = await page.evaluate(() => {
      const c = document.querySelector('[data-slot="select-content"]');
      return c ? { sh: c.scrollHeight, ch: c.clientHeight } : null;
    });
    console.log("select content scroll:", scrollState);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } else {
    console.log("currency trigger not found");
  }

  // Profile dropdown (avatar button in header, last button with rounded-xl border)
  const profileSel = await page.$('header button.rounded-xl.border');
  if (profileSel) {
    const b3 = await snapAll();
    console.log("BEFORE(profile):", JSON.stringify(b3), "bodyPad=" + await bodyPad());
    await profileSel.click();
    await page.waitForTimeout(600);
    const d3 = await snapAll();
    console.log("DURING(profile):", JSON.stringify(d3), "bodyPad=" + await bodyPad());
    console.log("header identical:", same(b3.header, d3.header));
    await page.keyboard.press("Escape");
  } else {
    console.log("profile button not found");
  }

  await browser.close();
})();
