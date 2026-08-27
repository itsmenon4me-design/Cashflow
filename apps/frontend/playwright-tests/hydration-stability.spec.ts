import { test, expect } from "@playwright/test";

/**
 * Hydration & FOUC regression suite.
 *
 * For every dashboard route:
 * 1. Hard-load the page and collect console errors.
 * 2. Assert NO "Hydration failed" / hydration mismatch errors appear.
 * 3. Assert the app shell (header + sidebar + main) is present immediately
 *    after load with styled layout (offsetWidth > 0 on the sidebar).
 * 4. Navigate via a sidebar link and assert the shell persists (same <aside>
 *    DOM node), proving no full-page reload / tree rebuild happens.
 */

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/accounts",
  "/incomes",
  "/expenses",
  "/transactions",
  "/categories",
  "/budgets",
  "/goals",
  "/investments",
  "/forecast",
  "/reports",
  "/analytics",
  "/notifications",
  "/audit-log",
  "/settings",
];

const HYDRATION_ERROR_PATTERNS = [
  /hydrat(e|ion) failed/i,
  /server rendered HTML didn't match/i,
  /There was an error while hydrating/i,
  /Hydration failed because/i,
];

test.describe("hydration stability", () => {
  // The app requires auth; seed localStorage before any page script runs.
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("cashflow.accessToken", "e2e-token");
      window.localStorage.setItem("cashflow.refreshToken", "e2e-refresh");
      window.localStorage.setItem(
        "cashflow.user",
        JSON.stringify({ name: "E2E Tester", email: "e2e@cashflow.test" })
      );
      // Language cookie must match what SSR reads so first paint matches HTML.
      document.cookie = "cashflow.language=id; path=/; max-age=31536000";
    });
  });

  for (const route of DASHBOARD_ROUTES) {
    test(`no hydration errors on ${route}`, async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (err) => {
        consoleErrors.push(String(err));
      });

      await page.goto(route, { waitUntil: "domcontentloaded" });

      // Shell must exist in the raw DOM right away (SSR output present).
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("aside").first()).toBeVisible();

      // Give React time to hydrate and flush any mismatch errors.
      await page.waitForTimeout(1500);

      const hydrationErrors = consoleErrors.filter((text) =>
        HYDRATION_ERROR_PATTERNS.some((pattern) => pattern.test(text))
      );
      expect(hydrationErrors).toEqual([]);
    });
  }

  test("sidebar navigation keeps one persistent shell (SPA behavior)", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("aside").first()).toBeAttached();
    await expect(page.locator("aside").first()).toBeVisible();
    await page.waitForTimeout(800);

    const asideConnected = await page
      .locator("aside")
      .first()
      .evaluate((el) => {
        // Tag the exact DOM node so we can prove it survives navigation.
        (el as HTMLElement).dataset.spaProbe = "1";
        return el.isConnected;
      });
    expect(asideConnected).toBe(true);

    // Click through three menu items via real sidebar links.
    for (const label of ["Transaksi", "Pengaturan", "Beranda"]) {
      await page.locator("aside").getByRole("link", { name: label }).first().click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await expect(page.locator("aside").first()).toBeVisible();
    }

    // The same <aside> element must still be attached — a full reload would
    // have replaced it with a new node (losing the data-spa-probe marker).
    const probeSurvived = await page
      .locator("aside[data-spa-probe='1']")
      .count();
    expect(probeSurvived).toBe(1);

    const hydrationErrors = consoleErrors.filter((text) =>
      HYDRATION_ERROR_PATTERNS.some((pattern) => pattern.test(text))
    );
    expect(hydrationErrors).toEqual([]);
  });
});
