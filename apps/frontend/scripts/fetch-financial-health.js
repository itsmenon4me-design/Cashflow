(async () => {
  try {
    const fetch = globalThis.fetch || (await import('node-fetch')).default;
    const API_BASE = 'http://localhost:3001/api/v1';
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
    if (!token) {
      console.error('No access token in login response', JSON.stringify(loginJson));
      process.exit(2);
    }

    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const end = new Date(); end.setHours(23,59,59,999);
    const endIso = end.toISOString();

    const url = `${API_BASE}/analytics/financial-health?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(endIso)}&currency=IDR`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    console.log('STATUS', res.status);
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
