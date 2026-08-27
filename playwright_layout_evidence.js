// Evidence-only script: NO app code changes. Collects DevTools-equivalent data.
// - computed CSS of <main> per page (Dashboard -> Investasi -> Kategori)
// - currency dropdown computed position + ancestor overflow chain up to <body>
// - layout-shift entries (PerformanceObserver) with source nodes during load & dropdown toggle
const { chromium } = require('@playwright/test');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const API = 'http://localhost:3001/api/v1';
const EMAIL = 'admin@cashflow.local';
const PASSWORD = 'admin123';
const OUT = './playwright-traces/layout-evidence';

const INIT_OBSERVER = () => {
  window.__shifts = [];
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__shifts.push({
          value: e.value,
          time: Math.round(e.startTime),
          sources: (e.sources || []).slice(0, 6).map((s) => ({
            node: (() => {
              let n = s.node;
              if (!n) return null;
              if (n.nodeType === 3) n = n.parentElement;
              if (!n || n.nodeType !== 1) return String(n);
              let d = n.tagName.toLowerCase();
              if (n.id) d += '#' + n.id;
              const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).slice(0, 5).join('.') : '';
              if (cls) d += '.' + cls;
              const t = (n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50);
              return t ? `${d} :: "${t}"` : d;
            })(),
            prev: s.previousRect ? [s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height] : null,
            curr: s.currentRect ? [s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height] : null,
          })),
        });
      }
    });
    po.observe({ type: 'layout-shift', buffered: true });
  } catch (err) {
    window.__shiftsError = String(err);
  }
};

async function dumpMain(page) {
  return page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        className: String(el.className).slice(0, 200),
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        computed: {
          height: cs.height, minHeight: cs.minHeight, maxHeight: cs.maxHeight,
          display: cs.display, position: cs.position,
          paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom,
          marginTop: cs.marginTop, marginBottom: cs.marginBottom,
          overflow: cs.overflow, overflowX: cs.overflowX, overflowY: cs.overflowY,
          boxSizing: cs.boxSizing,
        },
      };
    };
    const chain = [];
    let el = document.querySelector('main');
    while (el && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      chain.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0, 120),
        display: cs.display, position: cs.position,
        overflowX: cs.overflowX, overflowY: cs.overflowY,
        h: el.getBoundingClientRect().height,
      });
      el = el.parentElement;
    }
    const htmlCs = getComputedStyle(document.documentElement);
    const bodyCs = getComputedStyle(document.body);
    return {
      main: pick(document.querySelector('main')),
      ancestors: chain,
      html: { overflow: htmlCs.overflow, height: htmlCs.height },
      body: { overflow: bodyCs.overflow, height: bodyCs.height },
      docScroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
      viewport: { w: innerWidth, h: innerHeight },
    };
  });
}

async function drainShifts(page, label) {
  const shifts = await page.evaluate(() => { const a = window.__shifts || []; window.__shifts = []; return a; });
  if (shifts.length) console.log(`\n[LAYOUT-SHIFTS] ${label}: ${shifts.length} shift(s), total=${shifts.reduce((a, s) => a + s.value, 0).toFixed(5)}`);
  for (const s of shifts) {
    console.log(`  value=${s.value.toFixed(5)} t=+${s.time}ms`);
    for (const src of s.sources) {
      console.log(`    src: ${src.node}`);
      if (src.prev && src.curr && (src.prev[1] !== src.curr[1])) console.log(`      y ${src.prev[1]} -> ${src.curr[1]}  (h ${src.prev[3]} -> ${src.curr[3]})`);
    }
  }
  return shifts;
}

(async () => {
  fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });

  // 1) login via API
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login gagal: ${res.status} ${await res.text()}`);
  const body = await res.json();
  const data = body.data ?? body;
  const accessToken = data.access_token || data.accessToken;
  const refreshToken = data.refresh_token || data.refreshToken;
  console.log('LOGIN OK, token len=', (accessToken || '').length);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(
    ({ at, rt }) => {
      localStorage.setItem('cashflow.accessToken', at);
      localStorage.setItem('cashflow.refreshToken', rt);
      localStorage.setItem('cashflow.language', 'id');
    },
    { at: accessToken, rt: refreshToken },
  );
  await ctx.addInitScript(INIT_OBSERVER);
  const page = await ctx.newPage();

  // 2) <main> computed CSS di tiap halaman
  const report = {};
  for (const route of ['/dashboard', '/investments', '/categories']) {
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    } catch {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    }
    await page.waitForTimeout(2500); // biar semua async fetch selesai, shift stabil
    const info = await dumpMain(page);
    await drainShifts(page, route);
    report[route] = info;
    console.log(`\n===== MAIN ${route} =====`);
    console.log(JSON.stringify(info.main, null, 1));
    const name = route.replace(/\//g, '');
    await page.screenshot({ path: `${OUT}/screenshots/main-${name}.png` });
  }

  console.log('\n===== MAIN height antar halaman =====');
  for (const r of Object.keys(report)) console.log(r, '=> height:', report[r].main?.computed?.height, 'rectH:', Math.round(report[r].main?.rect?.h ?? -1));

  // 3) dropdown mata uang: posisi computed + rantai ancestor sampai body
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await drainShifts(page, '/dashboard idle');

  const trigger = page.locator('header button[role="combobox"]').first();
  await trigger.click();
  await page.waitForSelector('[role="listbox"]', { timeout: 5000 });
  await page.waitForTimeout(600);

  const dd = await page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 150), rect: { x: r.x, y: r.y, w: r.width, h: r.height }, computed: { position: cs.position, top: cs.top, left: cs.left, zIndex: cs.zIndex, transform: cs.transform === 'none' ? undefined : cs.transform.slice(0, 80), overflow: cs.overflow } };
    };
    const wrapper = document.querySelector('[data-radix-popper-content-wrapper]');
    const content = document.querySelector('[role="listbox"]');
    const chain = [];
    let el = content;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      chain.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 100), position: cs.position, overflow: cs.overflow, containsDropdownInFlow: cs.overflow !== 'visible' });
      el = el.parentElement;
    }
    return {
      wrapper: pick(wrapper),
      listbox: pick(content),
      ancestorChainToBody: chain,
      bodyPosition: getComputedStyle(document.body).position,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });
  report.dropdownOpen = dd;
  console.log('\n===== DROPDOWN MATA UANG TERBUKA =====');
  console.log(JSON.stringify(dd, null, 1));
  await page.screenshot({ path: `${OUT}/screenshots/dropdown-open.png` });

  // 4) rekam shift saat interaksi dropdown (buka->pilih->tutup)
  await drainShifts(page, 'sebelum pilih item');
  await page.locator('[role="listbox"] [role="option"]').nth(2).click().catch(async () => {
    await page.keyboard.press('Escape');
  });
  await page.waitForTimeout(1500);
  report.shiftsAfterSelect = await drainShifts(page, 'setelah pilih item dropdown');
  await page.screenshot({ path: `${OUT}/screenshots/dropdown-after-select.png` });

  // toggle sekali lagi untuk isolasi shift murni dari buka/tutup
  await trigger.click();
  await page.waitForTimeout(700);
  await drainShifts(page, 'buka ke-2');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  report.shiftsOnClose = await drainShifts(page, 'tutup dropdown (Escape)');
  await page.screenshot({ path: `${OUT}/screenshots/dropdown-closed.png` });

  fs.writeFileSync(`${OUT}/evidence.json`, JSON.stringify(report, null, 2));
  console.log('\nEVIDENCE_SAVED', OUT);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
