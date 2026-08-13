const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

(async ()=>{
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
  const API_BASE = process.env.TARGET_URL || 'http://localhost:3001/api/v1';
  const EMAIL = process.env.TEST_USER_EMAIL || 'admin@cashflow.local';
  const PASSWORD = process.env.TEST_USER_PASS || 'admin123';
  const outDir = path.join(__dirname);
  const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
  const jsonOut = path.join(outDir, `f2_income_offline_e2e_${timestamp}.json`);
  const mdOut = path.join(outDir, `f2_income_offline_e2e_${timestamp}.md`);
  const screenshotOut = path.join(outDir, `f2_income_offline_e2e_${timestamp}.png`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const result = { timestamp: new Date().toISOString(), frontend: FRONTEND, api: API_BASE, steps: [], consoleLogs: [] };
  page.on('console', msg => { try{ result.consoleLogs.push({ type: msg.type(), text: msg.text(), timestamp: new Date().toISOString() }); }catch(e){} });

  try{
    result.steps.push('goto frontend');
    await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', EMAIL).catch(()=>{});
    await page.fill('#password', PASSWORD).catch(()=>{});
    await page.click('button[type="submit"]').catch(()=>{});

    // wait for access token
    let accessToken = null;
    for(let i=0;i<40;i++){
      const t = await page.evaluate(()=>({ access: localStorage.getItem('cashflow.accessToken'), user: localStorage.getItem('cashflow.user') }));
      if(t && t.access){ accessToken = t.access; result.tokens = { access_present: true, user_present: !!t.user }; break; }
      await sleep(250);
    }
    if(!accessToken){ fs.writeFileSync(path.join(outDir, `f2_income_offline_login_failed_${timestamp}.html`), await page.content()); throw new Error('Login did not produce access token'); }

    // wait for client ready
    let ready = false;
    for(let i=0;i<60;i++){
      const r = await page.evaluate(()=>{ try{ return !!window.__app_client_ready }catch(e){ return false } });
      if(r){ ready = true; break; }
      await sleep(250);
    }
    result.appClientReady = ready;

    result.steps.push('fetch accounts and categories');
    const ids = await page.evaluate(async (args)=>{
      const { apiBase, token } = args;
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const acc = await fetch(`${apiBase}/accounts`, { headers }).then(r=>r.json()).catch(()=>null);
      const cat = await fetch(`${apiBase}/categories`, { headers }).then(r=>r.json()).catch(()=>null);
      return { accounts: acc && acc.data? acc.data : acc, categories: cat && cat.data? cat.data : cat };
    }, { apiBase: API_BASE, token: accessToken });

    if(!ids.accounts || !ids.accounts.length) throw new Error('No accounts found for test user');
    if(!ids.categories || !ids.categories.length) throw new Error('No categories found for test user');

    const accountId = ids.accounts[0].id;
    const incomeCat = ids.categories.find(c => (c.type && String(c.type).toUpperCase()==='INCOME') || (c.category_type && String(c.category_type).toUpperCase()==='INCOME')) || ids.categories[0];

    const uniqueRef = `offline-e2e-income-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const payload = {
      account_id: accountId,
      category_id: incomeCat.id || incomeCat.category_id || incomeCat.uuid,
      transaction_type: 'INCOME',
      amount_cents: 100000,
      transaction_date: new Date().toISOString(),
      note: `Offline Income ${uniqueRef}`,
      reference_number: uniqueRef,
    };

    result.steps.push('go offline');
    await context.setOffline(true);
    result.offline = true;

    // enqueue via window.syncController.enqueue
    result.steps.push('enqueue via syncController');
    const enqueueOk = await page.evaluate(async (args)=>{
      const { payload, entityId } = args;
      try{
        if(!window.syncController || typeof window.syncController.enqueue !== 'function') return { ok: false, reason: 'no-sync-controller' };
        await window.syncController.enqueue({ entityType: 'transaction', entityId, action: 'create', payload });
        const pending = await window.syncController.getPendingCount();
        return { ok: true, pending };
      }catch(e){ return { ok: false, reason: String(e) }; }
    }, { payload, entityId: payload.reference_number });

    result.enqueue = enqueueOk;
    if(!enqueueOk.ok) throw new Error('Enqueue failed: ' + JSON.stringify(enqueueOk));

    // verify IndexedDB pending > 0
    const pendingAfterEnqueue = await page.evaluate(async ()=>{ try{ return await window.syncController.getPendingCount(); }catch(e){ return -1; } });
    result.pendingAfterEnqueue = pendingAfterEnqueue;

    // go online and flush
    result.steps.push('go online and flush');
    await context.setOffline(false);
    result.offline = false;

    // call flush and wait for synced
    const flushResult = await page.evaluate(async ()=>{
      try{
        const r = await window.syncController.flush();
        return { status: r };
      }catch(e){ return { error: String(e) }; }
    });
    result.flushResult = flushResult;

    // wait and poll pending
    let remaining = await page.evaluate(async ()=>{ try{ return await window.syncController.getPendingCount(); }catch(e){ return -1; } });
    for(let i=0;i<30 && remaining>0;i++){
      await sleep(500);
      remaining = await page.evaluate(async ()=>{ try{ return await window.syncController.getPendingCount(); }catch(e){ return -1; } });
    }
    result.remainingAfterFlush = remaining;

    // screenshot
    await page.screenshot({ path: screenshotOut, fullPage: true });

    // DB verify
    const container = process.env.POSTGRES_CONTAINER || 'cashflow_local_postgres';
    const dbUser = process.env.POSTGRES_USER || 'cf_test';
    const dbName = process.env.POSTGRES_DB || 'cashflow_test';
    const grep = payload.note.replace(/'/g, "''");
    const sql = `SELECT count(*) FROM transactions WHERE note ILIKE '%${grep}%';`;
    let dbCount = null;
    try{
      const cmd = `docker exec -i ${container} psql -U ${dbUser} -d ${dbName} -t -c "${sql}"`;
      const out = execSync(cmd, { encoding: 'utf8' });
      dbCount = out.trim();
    }catch(e){ dbCount = String(e); }

    result.dbCount = dbCount;

    fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
    const md = [`# F.2 Income Offline UI E2E - ${timestamp}`, '', `UniqueRef: ${uniqueRef}`, '', `enqueueResult: ${JSON.stringify(enqueueOk)}`, '', `flushResult: ${JSON.stringify(flushResult)}`, '', `dbCount: ${dbCount}`].join('\n');
    fs.writeFileSync(mdOut, md);

    console.log('Income offline E2E complete. Results written to', jsonOut, mdOut, screenshotOut);
    await browser.close();
    process.exit(0);
  }catch(e){
    try{ fs.writeFileSync(path.join(outDir, `f2_income_offline_error_${timestamp}.log`), String(e.stack||e)); }catch(e){}
    console.error('Income offline e2e error', e);
    try{ await browser.close(); }catch(e){}
    process.exit(1);
  }
})();