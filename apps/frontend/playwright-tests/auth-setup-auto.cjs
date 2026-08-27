// Auto auth setup: login via API, inject tokens ke localStorage, save storageState.json
// Run: node playwright-tests/auth-setup-auto.cjs
// No manual interaction needed. Requires proxy-all.cjs running.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3001/api/v1';
const EMAIL = 'admin@cashflow.local';
const PASSWORD = 'admin123';
const OUT = path.join(__dirname, 'storageState.json');

(async () => {
  // 1. Login via API langsung (lewat proxy)
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    console.error(`Login API gagal: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const body = await res.json();
  const data = body.data ?? body;
  const accessToken = data.access_token || data.accessToken;
  const refreshToken = data.refresh_token || data.refreshToken;
  let user = data.user;
  // Fallback: ambil from /me kalau login response tidak kirim user object
  if (!user && accessToken) {
    const meRes = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (meRes.ok) {
      const meBody = await meRes.json();
      // Response: { success, data: { id, email, full_name, ... } }
      const userData = meBody.data ?? meBody;
      if (userData) {
        // Simpan id juga — dibutuhkan fallback PATCH /users/:id
        user = { id: userData.id, name: userData.full_name || userData.name || '', email: userData.email || '' };
      }
    }
  }
  if (!accessToken) {
    console.error('Response login tidak punya access_token:', JSON.stringify(body).slice(0, 300));
    process.exit(1);
  }
  console.log('Login OK. User:', user?.name || user?.email || 'unknown');

  // 2. Buka browser, inject localStorage di origin frontend
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(
    ({ at, rt, u }) => {
      window.localStorage.setItem('cashflow.accessToken', at);
      window.localStorage.setItem('cashflow.refreshToken', rt);
      window.localStorage.setItem('cashflow.language', 'id');
      if (u) window.localStorage.setItem('cashflow.user', JSON.stringify(u));
    },
    { at: accessToken, rt: refreshToken, u: user },
  );
  const page = await ctx.newPage();

  // 3. Kunjungi dashboard supaya initScript jalan + app hydrate
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('URL after goto:', page.url());

  const token = await page.evaluate(() => window.localStorage.getItem('cashflow.accessToken'));
  if (!token) {
    console.error('Token tidak ter-set di localStorage!');
    await browser.close();
    process.exit(1);
  }

  // 4. Save storage state
  const state = await ctx.storageState();
  fs.writeFileSync(OUT, JSON.stringify(state, null, 2), 'utf-8');
  const size = fs.statSync(OUT).size;
  console.log(`storageState.json saved: ${OUT}`);
  console.log(`  cookies=${state.cookies.length} origins=${state.origins.length} size=${size} bytes`);

  await browser.close();
  process.exit(0);
})();
