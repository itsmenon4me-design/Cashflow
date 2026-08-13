const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

(async ()=>{
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
  const API_BASE = process.env.TARGET_URL || 'http://localhost:3001/api/v1';
  const EMAIL = process.env.TEST_USER_EMAIL || 'admin@cashflow.local';
  const PASSWORD = process.env.TEST_USER_PASS || 'admin123';
  const outDir = path.join(__dirname);
  const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
  const jsonOut = path.join(outDir, `f2_income_e2e_${timestamp}.json`);
  const mdOut = path.join(outDir, `f2_income_e2e_${timestamp}.md`);
  const screenshotOut = path.join(outDir, `f2_income_e2e_${timestamp}.png`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const result = { timestamp: new Date().toISOString(), frontend: FRONTEND, api: API_BASE, steps: [], consoleLogs: [] };

  page.on('console', msg => {
    try{ result.consoleLogs.push({ type: msg.type(), text: msg.text(), location: msg.location ? msg.location() : null, timestamp: new Date().toISOString() }); }catch(e){}
  });

  try{
    // 1. Login
    result.steps.push('goto frontend root');
    await page.goto(`${FRONTEND}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.fill('#email', EMAIL).catch(()=>{});
    await page.fill('#password', PASSWORD).catch(()=>{});
    await page.click('button[type="submit"]').catch(()=>{});
    result.steps.push('login submitted');

    // wait for access token in localStorage up to 10 seconds
    let accessToken = null;
    for(let i=0;i<40;i++){
      const t = await page.evaluate(()=>({ access: localStorage.getItem('cashflow.accessToken'), user: localStorage.getItem('cashflow.user') }));
      if(t && t.access){ accessToken = t.access; result.tokens = { access_present: true, user_present: !!t.user }; break; }
      await sleep(250);
    }
    if(!accessToken){
      // capture debug page
      try{ const html = await page.content(); fs.writeFileSync(path.join(outDir, `f2_income_login_failed_${timestamp}.html`), html); }catch(e){}
      throw new Error('Login did not produce access token in localStorage');
    }

    // wait for client readiness
    let ready = false;
    for(let i=0;i<60;i++){
      const r = await page.evaluate(()=>{ try{ return !!window.__app_client_ready }catch(e){ return false } });
      if(r){ ready = true; break; }
      await sleep(250);
    }
    result.appClientReady = ready;

    // 2. Navigate to /incomes
    result.steps.push('navigate to /incomes');
    await page.goto(`${FRONTEND}/incomes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // 3. Ensure TransactionForm is NOT present by default, then open it via Add button
    const formPresentInitially = await page.isVisible('#transaction-date').catch(()=>false);
    result.formPresentInitially = formPresentInitially;
    if(formPresentInitially){
      try{ const html = await page.content(); fs.writeFileSync(path.join(outDir, `f2_income_form_present_by_default_${timestamp}.html`), html); }catch(e){}
      try{ await page.screenshot({ path: path.join(outDir, `f2_income_form_present_by_default_${timestamp}.png`), fullPage: true }); }catch(e){}
      throw new Error('TransactionForm visible by default on /incomes');
    }

    // click Add / open form
    const addBtn = await page.waitForSelector('button:has-text("Tambah Pemasukan"), button:has-text("+ Tambah Pemasukan"), button:has-text("Tambah Transaksi"), button:has-text("Add Transaction"), button:has-text("Add")', { timeout: 5000 }).catch(()=>null);
    if(!addBtn){
      try{ const html = await page.content(); fs.writeFileSync(path.join(outDir, `f2_income_addbtn_missing_${timestamp}.html`), html); }catch(e){}
      throw new Error('Add button not found on /incomes');
    }
    await addBtn.click();
    const formAppeared = await page.waitForSelector('#transaction-date', { timeout: 5000 }).then(()=>true).catch(()=>false);
    result.formAppeared = formAppeared;
    if(!formAppeared){
      try{ await page.screenshot({ path: path.join(outDir, `f2_income_form_not_appeared_${timestamp}.png`), fullPage: true }); }catch(e){}
      throw new Error('TransactionForm did not appear after clicking Add on /incomes');
    }

    // 4. fetch accounts and categories from API (to choose valid options)
    const ids = await page.evaluate(async (args) => {
      const { apiBase, token } = args;
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const acc = await fetch(`${apiBase}/accounts`, { headers }).then(r=>r.json()).catch(()=>null);
      const cat = await fetch(`${apiBase}/categories`, { headers }).then(r=>r.json()).catch(()=>null);
      return { accounts: acc && acc.data? acc.data : acc, categories: cat && cat.data? cat.data : cat };
    }, { apiBase: API_BASE, token: accessToken });

    if(!ids.accounts || !ids.accounts.length) throw new Error('No accounts found for test user');
    if(!ids.categories || !ids.categories.length) throw new Error('No categories found for test user');

    const accountName = ids.accounts[0].name || ids.accounts[0].account_name || ids.accounts[0].id;
    // choose a category with INCOME if available
    let chosenCategory = ids.categories.find(c => (c.type && String(c.type).toUpperCase()==='INCOME') || (c.category_type && String(c.category_type).toUpperCase()==='INCOME')) || ids.categories[0];
    const categoryName = chosenCategory.name || chosenCategory.title || chosenCategory.id;

    result.steps.push({ accountName, categoryName });

    // 5. Check if TransactionForm inputs exist (already recorded earlier)
    // 6. Create transaction via API (use POST) to avoid UI select complexity
    const uniqueRef = `e2e-income-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const payload = {
      account_id: ids.accounts[0].id,
      category_id: chosenCategory.id || chosenCategory.category_id || chosenCategory.uuid,
      transaction_type: 'INCOME',
      amount_cents: 100000, // 1000.00 depending on currency minor units
      transaction_date: new Date().toISOString(),
      note: `Income ${uniqueRef}`,
      reference_number: uniqueRef,
    };

    const apiCreate = await page.evaluate(async (args) => {
      const { apiBase, token, payload } = args;
      const res = await fetch(`${apiBase}/transactions`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }).then(r=>r.json()).catch(()=>({ error: true }));
      return res;
    }, { apiBase: API_BASE, token: accessToken, payload });
    result.apiCreate = apiCreate;

    if(!apiCreate || apiCreate.error) throw new Error('API create transaction failed: ' + JSON.stringify(apiCreate));

    // 7. Navigate to /transactions and search for the uniqueRef
    await page.goto(`${FRONTEND}/transactions`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const pageText = await page.content();
    result.pageContainsRef = pageText.includes(uniqueRef);

    // take screenshot
    await page.screenshot({ path: screenshotOut, fullPage: true });

    // 8. Verify via API search
    await page.waitForTimeout(1000);
    const searchRes = await page.evaluate(async (args)=>{
      const { apiBase, token, q } = args;
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch(`${apiBase}/transactions?q=${encodeURIComponent(q)}`, { headers }).then(r=>r.json()).catch(()=>null);
      return res;
    }, { apiBase: API_BASE, token: accessToken, q: uniqueRef });

    result.apiSearch = searchRes;

    // 7. Save JSON/MD
    result.uniqueRef = uniqueRef;
    fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));

    const md = [`# F.2 Income E2E - ${timestamp}`, '', `Frontend: ${FRONTEND}`, `API: ${API_BASE}`, '', '## Steps', '', ...result.steps.map(s=>`- ${typeof s==='string'?s:JSON.stringify(s)}`), '', `UniqueRef: ${uniqueRef}`, '', `Search result: ${JSON.stringify(searchRes,null,2)}`].join('\n');
    fs.writeFileSync(mdOut, md);

    console.log('E2E run complete. Results written to:', jsonOut, mdOut, screenshotOut);

    await browser.close();

    // 8. Query Postgres for exact match via docker exec
    const { execSync } = require('child_process');
    const container = process.env.POSTGRES_CONTAINER || 'cashflow_local_postgres';
    const dbUser = process.env.POSTGRES_USER || 'cf_test';
    const dbName = process.env.POSTGRES_DB || 'cashflow_test';
    const grep = uniqueRef.replace(/'/g, "''");
    const sql = `SELECT count(*) FROM transactions WHERE note ILIKE '%${grep}%';`;
    let dbCount = null;
    try{
      const cmd = `docker exec -i ${container} psql -U ${dbUser} -d ${dbName} -t -c "${sql}"`;
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
      dbCount = out.trim();
    }catch(e){ dbCount = String(e); }

    const verify = { json: jsonOut, md: mdOut, screenshot: screenshotOut, dbCount };
    const verifyOut = path.join(outDir, `f2_income_e2e_verify_${timestamp}.json`);
    fs.writeFileSync(verifyOut, JSON.stringify(verify, null, 2));
    console.log('DB verify written to', verifyOut);

  }catch(e){
    console.error('E2E error', e);
    try{ await browser.close(); }catch(e){}
    const errOut = path.join(outDir, `f2_income_e2e_error_${new Date().toISOString().replace(/[:.]/g,'-')}.log`);
    fs.writeFileSync(errOut, String(e));
    process.exit(1);
  }
})();