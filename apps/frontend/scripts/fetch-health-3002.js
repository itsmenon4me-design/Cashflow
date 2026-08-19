(async () => {
  try {
    const fetch = globalThis.fetch || (await import('node-fetch')).default;
    const API_BASE = 'http://127.0.0.1:3002/api/v1';
    const email = 'e2e.api.user@test.local';
    const password = process.env.E2E_PASSWORD || 'TestPass123!';

    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginJson = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed', loginRes.status, loginJson);
      process.exit(2);
    }
    const token = loginJson?.data?.accessToken;

    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const end = new Date(); end.setHours(23,59,59,999);
    const endIso = end.toISOString();
    const currency = 'IDR';

    async function get(path) {
      const url = `${API_BASE}${path}?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(endIso)}&currency=${currency}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      return { status: res.status, json };
    }

    const overview = await get('/analytics/overview');
    const expenses = await get('/analytics/expenses');
    const health = await get('/analytics/financial-health');

    console.log('\n=== OVERVIEW ===\nStatus:', overview.status, '\n', JSON.stringify(overview.json, null, 2));
    console.log('\n=== EXPENSES ===\nStatus:', expenses.status, '\n', JSON.stringify(expenses.json, null, 2));
    console.log('\n=== HEALTH ===\nStatus:', health.status, '\n', JSON.stringify(health.json, null, 2));

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
