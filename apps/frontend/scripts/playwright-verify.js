const { chromium } = require('@playwright/test');
const fs = require('fs');

async function isRadioChecked(page, id) {
  return await page.evaluate((id) => {
    const selectors = [
      `#${id}`,
      `[data-slot="radio-group-item"]#${id}`,
      `[data-slot="radio-group-item"][id="${id}"]`,
      `input#${id}`,
      `[role="radio"]#${id}`,
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      // Native radio input
      if (el.tagName && el.tagName.toLowerCase() === 'input') {
        try {
          if (el.checked === true) return true;
        } catch (e) {}
      }
      // Check common attributes Radix and ARIA use
      const aria = el.getAttribute && el.getAttribute('aria-checked');
      if (aria === 'true') return true;
      const ds = el.getAttribute && el.getAttribute('data-state');
      if (ds === 'checked') return true;
      // Maybe contains a native input inside
      try {
        const input = el.querySelector && el.querySelector('input');
        if (input && input.checked === true) return true;
      } catch (e) {}
    }
    // Last-resort: find checked radio-group-item and compare id
    const checkedItem = document.querySelector('[data-slot="radio-group-item"][data-state="checked"], [data-slot="radio-group-item"][aria-checked="true"]');
    if (checkedItem) {
      const cid = checkedItem.id || checkedItem.getAttribute('id');
      if (cid === id) return true;
    }
    return false;
  }, id);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE_CONSOLE', msg.type(), msg.text()));

  const pagesToCheck = [
    { url: '/dashboard', sample: ['h1', '[role="heading"]'] },
    { url: '/accounts', sample: ['h1', '[role="heading"]'] },
    { url: '/incomes', sample: ['h1', '[role="heading"]'] },
    { url: '/expenses', sample: ['h1', '[role="heading"]'] },
    { url: '/transactions', sample: ['h1', '[role="heading"]'] },
    { url: '/categories', sample: ['h1', '[role="heading"]'] },
    { url: '/budgets', sample: ['h1', '[role="heading"]'] },
    { url: '/goals', sample: ['h1', '[role="heading"]'] },
    { url: '/investments', sample: ['h1', '[role="heading"]'] },
    { url: '/reports', sample: ['h1', '[role="heading"]'] },
    { url: '/analytics', sample: ['h1', '[role="heading"]'] },
    { url: '/notifications', sample: ['h1', '[role="heading"]'] },
    { url: '/settings', sample: ['h1', '[role="heading"]'] },
  ];

  const base = 'http://localhost:3000';
  const results = [];

  for (const p of pagesToCheck) {
    try {
      // Use direct navigation and then wait explicitly for the page heading to appear.
      const start = Date.now();
      await page.goto(base + p.url, { waitUntil: 'domcontentloaded' });
      let visible = false;
      let elapsed = 0;
      try {
        // Wait for an h1 to appear with text within 5s. If p.sample includes alternatives, use them as fallbacks.
        const sel = 'h1';
        await page.waitForSelector(sel, { timeout: 5000 });
        // Ensure it has text content (client-rendered apps may hydrate after DOM insertion)
        const text = await page.evaluate(() => (document.querySelector('h1')?.innerText || '').trim());
        elapsed = Date.now() - start;
        visible = Boolean(text && text.length > 0);
        // If not visible, attempt the alternative selectors from p.sample
        if (!visible && Array.isArray(p.sample)) {
          for (const alt of p.sample) {
            try {
              await page.waitForSelector(alt, { timeout: 1000 });
              const altText = await page.evaluate((a) => (document.querySelector(a)?.innerText || '').trim(), alt);
              if (altText && altText.length > 0) { visible = true; break; }
            } catch (e) { /* ignore */ }
          }
        }
      } catch (err) {
        // waitForSelector timed out; mark elapsed up to now
        elapsed = Date.now() - start;
        visible = false;
      }
      results.push({ page: p.url, navigated: true, visible, elapsed });
    } catch (e) {
      results.push({ page: p.url, error: e.message });
    }
  }

  const langResult = { page: '/settings' };
  try {
    await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const enEl = await page.$('#lang-en');
    const enLabel = await page.$('label[for="lang-en"]');
    const getH1Text = async () => (await page.evaluate(() => document.querySelector('h1')?.innerText || '')).trim();
    const beforeH1 = await getH1Text();
    // Prefer clicking the label (accessibility) which toggles Radix-controlled items reliably; fall back to the element itself.
    const clickTarget = enLabel ? 'label[for="lang-en"]' : (enEl ? '#lang-en' : null);
    const start = Date.now();
    if (clickTarget) {
      const el = await page.$(clickTarget);
      if (el) await el.click();
    }
    let h1ChangedMs = null;
    let radioChangedMs = null;
    const maxMs = 4000;
    const pollInterval = 25;
    const deadline = Date.now() + maxMs;
    const initialRadioState = await (async () => {
      try {
        const testEl = page.getByTestId('lang-en');
        const testAttr = await testEl.getAttribute('aria-checked').catch(() => null);
        if (testAttr === 'true') return true;
        const ds = await testEl.getAttribute('data-state').catch(() => null);
        if (ds === 'checked') return true;
      } catch (e) {}
      try {
        const roleAttr = await page.getByRole('radio', { name: 'English' }).getAttribute('aria-checked');
        if (roleAttr === 'true') return true;
      } catch (e) {}
      return await isRadioChecked(page, 'lang-en');
    })();
    while ((h1ChangedMs === null || radioChangedMs === null) && Date.now() < deadline) {
      await page.waitForTimeout(pollInterval);
      const now = Date.now();
      const h1Now = await getH1Text();
      if (h1ChangedMs === null && h1Now !== beforeH1) {
        h1ChangedMs = now - start;
      }
      const radioNow = await (async () => {
        try {
          const testEl = page.getByTestId('lang-en');
          const testAttr = await testEl.getAttribute('aria-checked').catch(() => null);
          if (testAttr === 'true') return true;
          const ds = await testEl.getAttribute('data-state').catch(() => null);
          if (ds === 'checked') return true;
        } catch (e) {}
        try {
          const roleAttr = await page.getByRole('radio', { name: 'English' }).getAttribute('aria-checked');
          if (roleAttr === 'true') return true;
          if (roleAttr === 'false') return false;
        } catch (e) {}
        return await isRadioChecked(page, 'lang-en');
      })();
      if (radioChangedMs === null && radioNow !== initialRadioState && radioNow === true) {
        radioChangedMs = now - start;
      }
    }
    langResult.h1ChangedMs = h1ChangedMs;
    langResult.radioChangedMs = radioChangedMs;
    langResult.h1Before = beforeH1;
    langResult.h1After = await getH1Text();
    langResult.radioInitiallyChecked = initialRadioState;
    langResult.radioFinallyChecked = await isRadioChecked(page, 'lang-en');
  } catch (e) {
    langResult.error = e.message;
  }
  results.push({ languageToggle: langResult });

  console.log('VERIFY_RESULTS', JSON.stringify(results, null, 2));
  fs.writeFileSync('playwright_verify_results.json', JSON.stringify(results, null, 2));
  await browser.close();
})();