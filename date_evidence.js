// Evidence-only: date/time rendering across pages. NO app code changes.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API = 'http://localhost:3001/api/v1';
const EMAIL = 'admin@cashflow.local';
const PASSWORD = 'admin123';
const OUT = './playwright-traces/date-evidence';

const ROUTES = [
  ['dashboard', '/dashboard'],
  ['incomes', '/incomes'],
  ['expenses', '/expenses'],
  ['transactions', '/transactions'],
  ['budgets', '/budgets'],
  ['goals', '/goals'],
  ['investments', '/investments'],
  ['audit-log', '/audit-log'],
];

// lines that look like they contain a date or time
function dateish(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const hits = new Set();
  const reDate = /(\d{1,4}[\s\/\-.]\d{1,2}[\s\/\-.]\d{2,4})|(\d{1,2}\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des|Januari|Februari|Maret|April|Agustus|September|Oktober|November|Desember)[a-z]*\s+\d{2,4})|((Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)[a-z]*\s+\d{1,2},?\s+\d{4})/i;
  const reTime = /\b\d{1,2}:\d{2}(:\d{2})?\b/;
  for (const l of lines) {
    if (reDate.test(l) || reTime.test(l)) hits.add(l.slice(0, 120));
  }
  return [...hits].slice(0, 25);
}

(async () => {
  fs.mkdirSync(`${OUT}`, { recursive: true });
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const tok = login.data.accessToken;

  // Seed one row per module so every page renders its date format (data-only, idempotent-ish).
  try {
    const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` };
    const j = (r) => r.json().catch(() => null);
    let acc = await j(await fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${tok}` } }));
    let accountId = acc?.data?.[0]?.id;
    if (!accountId) {
      accountId = (await j(await fetch(`${API}/accounts`, { method: 'POST', headers: hdr, body: JSON.stringify({ name: 'Bank Buktian', account_type: 'BANK' }) })))?.data?.id;
    }
    const cats = (await j(await fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${tok}` } })))?.data ?? [];
    const inc = cats.find((c) => c.type === 'INCOME');
    const exp = cats.find((c) => c.type === 'EXPENSE');
    const now = new Date();
    const txs = await j(await fetch(`${API}/transactions?page=1&limit=1`, { headers: { Authorization: `Bearer ${tok}` } }));
    if ((txs?.pagination?.totalItems ?? 0) === 0 && accountId && inc && exp) {
      await fetch(`${API}/transactions`, { method: 'POST', headers: hdr, body: JSON.stringify({ account_id: accountId, category_id: inc.id, transaction_type: 'INCOME', amount_cents: 5000000, transaction_date: new Date(now.getTime() - 26 * 3600e3).toISOString(), note: 'Gaji Bulanan' }) });
      await fetch(`${API}/transactions`, { method: 'POST', headers: hdr, body: JSON.stringify({ account_id: accountId, category_id: exp.id, transaction_type: 'EXPENSE', amount_cents: 150000, transaction_date: now.toISOString(), note: 'Belanja Mingguan' }) });
    }
    if (inc && exp) {
      await fetch(`${API}/budgets`, { method: 'POST', headers: hdr, body: JSON.stringify({ category_id: exp.id, budget_amount_cents: 2000000, month: now.getMonth() + 1, year: now.getFullYear() }) }).catch(() => {});
    }
    await fetch(`${API}/saving-goals`, { method: 'POST', headers: hdr, body: JSON.stringify({ name: 'Dana Darurat', target_amount_cents: 10000000, start_date: new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10), target_date: new Date(now.getTime() + 90 * 864e5).toISOString().slice(0, 10) }) }).catch(() => {});
    await fetch(`${API}/investments`, { method: 'POST', headers: hdr, body: JSON.stringify({ name: 'Saham Buktitama', investment_type: 'STOCK', platform: 'Mirae', quantity: 100, average_buy_price: 1500, current_price: 1750, purchase_date: new Date(now.getTime() - 14 * 864e5).toISOString().slice(0, 10) }) }).catch(() => {});
    console.log('SEED done');
  } catch (e) {
    console.log('SEED skipped:', String(e).slice(0, 120));
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  await ctx.addInitScript(({ at, rt }) => {
    localStorage.setItem('cashflow.accessToken', at);
    localStorage.setItem('cashflow.refreshToken', rt);
    localStorage.setItem('cashflow.language', 'id');
  }, { at: tok, rt: login.data.refreshToken });
  const page = await ctx.newPage();

  // server clock reference
  let serverDateHeader = null;
  try {
    const r = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${tok}` } });
    serverDateHeader = r.headers.get('date');
  } catch {}
  const report = {
    context: {
      clientLocale: 'id-ID', clientTZ: 'Asia/Jakarta',
      localNow: new Date().toString(),
      utcNow: new Date().toUTCString(),
      serverDateHeader,
    },
    pages: {},
  };
  console.log('LOCAL :', report.context.localNow);
  console.log('SERVER:', serverDateHeader);

  for (const [name, route] of ROUTES) {
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    } catch {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    }
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const headerPill = document.querySelector('header .tabular-nums')?.textContent ?? null;
      const dateInputs = [...document.querySelectorAll('input[type="date"]')].map((i) => ({
        value: i.value, placeholder: i.getAttribute('placeholder'), shown: i.placeholder ?? null,
      }));
      return { headerPill, dateInputs, hits: null, text: document.body.innerText };
    });
    const hits = dateish(info.text);
    delete info.text;
    info.dateLines = hits;
    report.pages[name] = info;
    console.log(`\n=== ${name} (${route}) header="${info.headerPill}"`);
    console.log(' dateInputs:', JSON.stringify(info.dateInputs));
    hits.forEach((h) => console.log('   •', h));
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  }

  fs.writeFileSync(`${OUT}/dates.json`, JSON.stringify(report, null, 2));
  console.log('\nDATE_EVIDENCE_SAVED', OUT);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
