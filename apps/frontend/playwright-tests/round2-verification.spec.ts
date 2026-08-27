import { test, expect, type Page } from "@playwright/test";

/**
 * Round 2 verification suite — behavior-based assertions per task.
 * Auth: storageState.json (loaded globally in playwright.config.ts).
 */

// A1: Top bar layout stability when dropdowns open
test.describe("A1: Top bar layout stability when dropdowns open", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("search/input area stays static when notification dropdown opens", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("header", { timeout: 15000 });
    await page.waitForTimeout(800);

    // Robust selectors: search input via aria-label, right-side icon cluster via ml-auto container
    const searchBox = page.locator("header input[aria-label]").first();
    const rightCluster = page.locator("header div.ml-auto").first();

    const searchBefore = await searchBox.boundingBox();
    const rightBefore = await rightCluster.boundingBox();
    expect(searchBefore, "search input harus terlihat di header").not.toBeNull();
    expect(rightBefore, "right cluster (ikon) harus terlihat di header").not.toBeNull();

    // Bell button: pakai CSS selector karena aria-label tidak terus dengan baik via DropdownMenuTrigger asChild
    const bellBtn = page.locator("header button[aria-label='Notifikasi'], header button[aria-label*='notif' i]").first();
    await bellBtn.click();
    await page.waitForTimeout(400);

    const searchAfter = await searchBox.boundingBox();
    const rightAfter = await rightCluster.boundingBox();
    expect(searchAfter?.x).toBeCloseTo(searchBefore!.x, 1);
    expect(rightAfter?.x).toBeCloseTo(rightBefore!.x, 1);

    await page.keyboard.press("Escape");
  });

  test("profile dropdown does not shift notification icon", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("header", { timeout: 15000 });
    await page.waitForTimeout(800);

    const notifBtn = page.locator("header button[aria-label='Notifikasi'], header button[aria-label*='notif' i]").first();
    const notifBefore = await notifBtn.boundingBox();
    expect(notifBefore).not.toBeNull();

    const avatarBtn = page.locator("header button[aria-haspopup='menu']").last();
    await avatarBtn.click();
    await page.waitForTimeout(300);

    const notifAfter = await notifBtn.boundingBox();
    expect(notifAfter?.x).toBeCloseTo(notifBefore!.x, 1);
    await page.keyboard.press("Escape");
  });

  test("A1-currency: top bar elements do not shift when currency dropdown opens", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("header", { timeout: 15000 });
    await page.waitForTimeout(800);

    const searchInput = page.locator("header input[aria-label]").first();
    const notifBtn = page.locator("header button[aria-label='Notifikasi'], header button[aria-label*='notif' i]").first();
    const themeBtn = page.locator("header button[aria-label*='terang' i], header button[aria-label*='light' i], header button[aria-label*='gelap' i], header button[aria-label*='dark' i]").first();

    const before = {
      search: await searchInput.boundingBox(),
      notif: await notifBtn.boundingBox(),
      theme: await themeBtn.boundingBox(),
    };
    expect(before.search).not.toBeNull();
    expect(before.notif).not.toBeNull();
    expect(before.theme).not.toBeNull();

    // Currency dropdown trigger: SelectTrigger menampilkan kode mata uang aktif (mis. "IDR")
    const currencyTrigger = page.locator("header [data-slot='select-trigger']").first();
    await currencyTrigger.waitFor({ state: "visible", timeout: 5000 });
    await currencyTrigger.click();
    await page.waitForTimeout(400); // tunggu dropdown panel terbuka penuh

    const afterOpen = {
      search: await searchInput.boundingBox(),
      notif: await notifBtn.boundingBox(),
      theme: await themeBtn.boundingBox(),
    };

    // Toleransi 0px: posisi x harus SAMA PERSIS saat dropdown terbuka
    expect(afterOpen.search?.x).toBe(before.search!.x);
    expect(afterOpen.notif?.x).toBe(before.notif!.x);
    expect(afterOpen.theme?.x).toBe(before.theme!.x);

    // Tutup dropdown (Escape), pastikan posisi balik semula
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const afterClose = {
      search: await searchInput.boundingBox(),
      notif: await notifBtn.boundingBox(),
      theme: await themeBtn.boundingBox(),
    };
    expect(afterClose.search?.x).toBe(before.search!.x);
    expect(afterClose.notif?.x).toBe(before.notif!.x);
    expect(afterClose.theme?.x).toBe(before.theme!.x);
  });
});

// A2: Window focus does not cause full reload / skeleton flash
test.describe("A2: Window focus does not cause full reload / skeleton flash", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("visibility toggle does not remount shell or show skeleton", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("header", { timeout: 15000 });
    // Tunggu data loaded (KPI value terisi) — beri waktu API call selesai
    await page.waitForTimeout(2500);

    const countSkeletons = () =>
      page.locator(".animate-pulse, [class*='skeleton']").count();
    const skeletonBefore = await countSkeletons();

    // Probe element reference untuk deteksi remount
    await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.id = "shell-probe";
      document.body.appendChild(probe);
    });
    await page.waitForTimeout(500);
    const probeBefore = await page.$("#shell-probe");
    expect(probeBefore).not.toBeNull();

    // Simulasi visibility toggle (dispatch lewat evaluate — page.dispatchEvent tak support document)
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await page.waitForTimeout(1500);

    const probeAfter = await page.$("#shell-probe");
    expect(probeAfter, "shell tidak boleh remount saat visibility toggle").not.toBeNull();

    const skeletonAfter = await countSkeletons();
    // Skeleton boleh ada di initial load (belum data), tapi setelah data loaded harus 0
    if (skeletonBefore === 0) {
      expect(skeletonAfter, "skeleton tidak boleh muncul saat refetch background").toBe(0);
    }
  });
});

// A3: Search typing does not show skeleton flash
test.describe("A3: Search typing does not show skeleton flash", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("search input keeps existing rows visible during typing", async ({ page }) => {
    await page.goto("/transactions", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 15000 });

    // Tunggu content render: card row ATAU empty state ATAU error state
    await page.waitForSelector(
      "main [data-slot='card'], main [class*='rounded-xl'], main [class*='empty'], main [class*='error']",
      { state: "attached", timeout: 15000 },
    );
    await page.waitForTimeout(500);

    // Search input di transactions page: bahasa-netral (placeholder bisa "Cari..." atau "Search...")
    const searchInput = page
      .locator("main input[type='search'], main input[placeholder*='Cari'], main input[placeholder*='Search'], main input[aria-label*='Cari'], main input[aria-label*='search' i]")
      .first();
    await searchInput.waitFor({ state: "attached" });

    // Hitung jumlah baris/item sebelum typing (card-based, bukan table)
    const rowCountBefore = await page.locator("main [data-slot='card'] > div, main [class*='transaction-row'], main tbody tr").count();

    await searchInput.fill("a");
    await page.waitForTimeout(150);

    // Old rows still there (stale-while-revalidate)
    const rowCountDuring = await page.locator("main [data-slot='card'] > div, main [class*='transaction-row'], main tbody tr").count();
    expect(rowCountDuring).toBe(rowCountBefore);

    const skeletonDuring = await page.locator(".animate-pulse").count();
    expect(skeletonDuring).toBe(0);
  });
});

// A4: Sidebar/header do not move on navigation
test.describe("A4: Sidebar/header do not move on navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("sidebar position fixed across route changes", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("aside", { timeout: 15000 });
    await page.waitForTimeout(800);

    const sidebar = page.locator("aside").first();
    const sidebarBefore = await sidebar.boundingBox();
    expect(sidebarBefore).not.toBeNull();

    await page.click("nav a[href='/transactions']");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);

    const sidebarAfter = await sidebar.boundingBox();
    expect(sidebarAfter?.x).toBeCloseTo(sidebarBefore!.x, 1);
    expect(sidebarAfter?.width).toBeCloseTo(sidebarBefore!.width, 1);

    await page.click("nav a[href='/settings']");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);

    const sidebarFinal = await sidebar.boundingBox();
    expect(sidebarFinal?.x).toBeCloseTo(sidebarBefore!.x, 1);
    expect(sidebarFinal?.width).toBeCloseTo(sidebarBefore!.width, 1);
  });
});

// B1: Profile page read-only + edit toggle
test.describe("B1: Profile page read-only + edit toggle", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("profile page read-only default + edit toggle + persist name", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 15000 });
    await page.waitForTimeout(500);

    // Tombol edit pakai aria-label "Ubah" (dari uiText.common.edit)
    const editBtn = page.getByRole("button", { name: /ubah|edit/i }).first();
    await expect(editBtn).toBeVisible();

    // Default read-only: tidak ada input name + tidak ada tombol save
    await expect(page.locator("input#profile-name")).toHaveCount(0);
    const saveCount = await page
      .locator("#profile-name").locator("..").locator("button")
      .count();
    expect(saveCount).toBe(0);

    await editBtn.click();

    // Setelah edit: input name muncul + tombol save visible
    const nameInput = page.locator("input#profile-name").first();
    await expect(nameInput).toBeVisible();
    // Save button: aria-label = uiText.common.save ("Simpan"/"Save")
    const saveBtn = page.getByRole("button", { name: /simpan|save/i }).first();
    await expect(saveBtn).toBeVisible();

    // closed-loop: edit nama, save, reload → pastikan persisted
    const newName = "Automation Test " + Date.now().toString().slice(-4);
    await nameInput.fill(newName);

    // Intercept API response untuk verifikasi save sukses
    const [apiRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/users/") && r.request().method() === "PATCH", { timeout: 10000 }),
      saveBtn.click(),
    ]);
    const apiBody = await apiRes.json();
    const isSuccess = apiBody?.success !== false;
    expect(isSuccess, `PATCH save gagal: ${JSON.stringify(apiBody).slice(0, 150)}`).toBe(true);

    // Tunggu save selesai: input name harus hilang (edit mode exit)
    await page.locator("#profile-name").waitFor({ state: "detached", timeout: 8000 });
    await page.waitForTimeout(500);

    // Reload halaman + cek nama terbaru persisted di UI
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Cek nama baru muncul di header user (bukti persist ke backend + localStorage refresh)
    const userAvatar = page.locator("header button[aria-haspopup='menu']").first();
    await expect(userAvatar.getByText(newName)).toBeVisible({ timeout: 8000 });
  });
});

// B2: Dashboard global search returns grouped results
test.describe("B2: Dashboard global search returns grouped results", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("global search panel opens with categorized results", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("header", { timeout: 15000 });
    await page.waitForTimeout(500);

    // GlobalSearch input: aria-label "Pencarian global" (id locale)
    const searchInput = page
      .getByRole("textbox", { name: /pencarian global|global search/i })
      .first();
    await searchInput.waitFor({ state: "attached" });

    await searchInput.fill("makan");
    await page.waitForTimeout(800); // debounce 300ms + fetch

    // Panel harus terbuka
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 5000 });

    // closed-loop: minimal satu group header ada, dan hasil-nya match keyword "makan"
    const groupHeaders = await page
      .getByRole("listbox")
      .locator("[class*='font-semibold'], [class*='uppercase'], [class*='group']")
      .count();
    expect(groupHeaders).toBeGreaterThan(0);

    // Verifikasi hasil memang mengandung "makan" (bukan sekadar panel terbuka)
    const allRows = await page.getByRole("listbox").locator("[role='option']").allInnerTexts();
    const matchingRows = allRows.filter((t) => /makan/i.test(t));
    expect(matchingRows.length).toBeGreaterThan(0);

    await searchInput.fill("");
  });
});

// B3: System categories have edit/delete (no lock)
test.describe("B3: System categories have edit/delete (no lock)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("system category cards have edit button, no lock icon", async ({ page }) => {
    await page.goto("/categories", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 15000 });
    // Tunggu kategori render — table ATAU card ATAU empty state
    await page.waitForSelector(
      "main table, main [data-slot='card'], main [class*='empty'], main [class*='error']",
      { state: "attached", timeout: 15000 },
    );
    await page.waitForTimeout(500);

    // Badge "Sistem" sudah dihapus sesuai spec — tidak harus ada
    // Lock icon tidak boleh ada
    const lockCount = await page
      .locator("[data-lucide='lock'], svg[class*='lock'], .lock-icon")
      .count();
    expect(lockCount).toBe(0);

    // Setiap card/kategori harus punya minimal satu action button (edit/delete)
    const firstRow = page.locator("main table tbody tr, main [data-slot='card']").first();
    const hasActionButton = (await firstRow.locator("button").count()) >= 1;
    expect(hasActionButton).toBe(true);

    // closed-loop: klik edit kategori pertama, ganti nama, save, reload → cek berubah
    // Edit button: aria-label "Ubah <nama>" / "Edit <nama>" (dari CategoryRowActions)
    const firstEditBtn = page.locator("main table tbody tr").first().locator("button[aria-label]").nth(1); // actions: view, edit, delete → index 1 = edit
    await firstEditBtn.waitFor({ state: "visible", timeout: 5000 });

    const editedName = "Edited_" + Date.now().toString().slice(-4);

    await firstEditBtn.click();
    // Dialog form terbuka — input nama pakai id "category-name"
    const formInput = page.locator("#category-name");
    await expect(formInput).toBeVisible({ timeout: 5000 });
    await formInput.fill(editedName);
    // Submit: button type="submit" dengan text Simpan/Save di dialog footer
    await page.locator("[role='dialog'] button[type='submit']").click();

    // Tunggu dialog tutup (form submit selesai)
    await page.locator("#category-name").waitFor({ state: "detached", timeout: 8000 });
    await page.waitForTimeout(500);

    // Reload + verifikasi nama baru muncul di list
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("main table tbody tr", { timeout: 15000 });
    await page.waitForTimeout(800);
    // Cari nama edited di seluruh list kategori
    await expect(page.locator("main").getByText(editedName)).toBeVisible({ timeout: 5000 });
  });
});

// B4: Language change re-renders text reactively
test.describe("B4: Language change re-renders text reactively", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("language switch updates dashboard title without refresh", async ({ page }) => {
    // Reset bahasa ke Indonesia dulu — setting bahasa persist di backend,
    // jadi state awal bisa saja EN dari run/test sebelumnya.
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 15000 });
    const langId = page.locator('main button[value="id"]').first();
    await langId.waitFor({ state: "attached" });
    await langId.click();
    await page.waitForTimeout(800);

    await page.goto("/dashboard");
    await page.waitForSelector("main h1", { timeout: 15000 });

    const titleId = await page.locator("main h1").first().textContent();
    // Greeting Indonesia: "Selamat pagi/siang/sore/malam, ..."
    expect(titleId).toMatch(/Selamat/i);

    await page.goto("/settings");
    await page.waitForTimeout(500);

    // Toggle bahasa EN: settings page pakai BUTTON dengan attribute value="en"
    const langEn = page.locator('main button[value="en"]').first();
    await langEn.waitFor({ state: "attached" });
    await langEn.click();
    await page.waitForTimeout(800);

    await page.goto("/dashboard");
    await page.waitForTimeout(1000);

    const titleEn = await page.locator("main h1").first().textContent();
    // Greeting English: "Good morning/afternoon/evening, ..."
    expect(titleEn).toMatch(/Good (morning|afternoon|evening)/i);
    expect(titleId).not.toBe(titleEn);
  });
});

// B5: Audit log 'Hapus Semua' button + confirmation
test.describe("B5: Audit log 'Hapus Semua' button + confirmation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("'Hapus Semua' button exists and triggers confirm dialog", async ({ page }) => {
    await page.goto("/audit-log", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 15000 });
    await page.waitForTimeout(800);

    const deleteBtn = page.locator("button:has-text('Hapus Semua'), button:has-text('Delete All')").first();
    await expect(deleteBtn).toBeVisible();

    let dialogMsg = "";
    page.on("dialog", async (dialog) => {
      dialogMsg = dialog.message();
      dialog.dismiss();
    });

    await deleteBtn.click();
    await page.waitForTimeout(500);

    expect(dialogMsg).toMatch(/hapus|delete|semua|all/i);
  });

  test("Reset Filters button visible", async ({ page }) => {
    await page.goto("/audit-log", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 15000 });
    await page.waitForTimeout(500);

    await expect(page.locator("button:has-text('Reset')")).toBeVisible();
  });
});
