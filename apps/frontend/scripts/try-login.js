(async ()=>{
  const { request } = require('playwright');
  const API_BASE = 'http://localhost:3001/api/v1';
  const tryEmails = ['e2e.user@test.local','e2e.api.user@test.local','e2e.income2@test.local','e2e@test.local','e2e.user@test.local'];
  const E2E_PASSWORD = process.env.E2E_PASSWORD || 'TestPass123!';
  const req = await request.newContext({ baseURL: API_BASE });
  for (const email of tryEmails) {
    try {
      const res = await req.post('/auth/login', { data: { email, password: E2E_PASSWORD } });
      console.log(email, '->', res.status());
      if (res.status() === 200) {
        const body = await res.json();
        console.log('SUCCESS for', email, JSON.stringify(body, null, 2));
        break;
      } else {
        try { const b = await res.json(); console.log('body', b); } catch(e) {}
      }
    } catch(e) {
      console.error('error for', email, e.message);
    }
  }
  await req.dispose();
})();