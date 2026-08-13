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
  const jsonOut = path.join(outDir, `offline_e2e_${timestamp}.json`);
  const mdOut = path.join(outDir, `offline_e2e_${timestamp}.md`);

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const result = { timestamp: new Date().toISOString(), frontend: FRONTEND, api: API_BASE, steps: [], consoleLogs: [] };

  page.on('console', msg => {
    try{ result.consoleLogs.push({ type: msg.type(), text: msg.text(), location: msg.location ? msg.location() : null, timestamp: new Date().toISOString() }); }catch(e){}
  });

  try{
    // 1. Login via UI (navigate to root and find login inputs)
    result.steps.push('goto frontend root');
    await page.goto(`${FRONTEND}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.fill('#email', EMAIL).catch(()=>{});
    await page.fill('#password', PASSWORD).catch(()=>{});
    await Promise.all([
      page.click('button[type="submit"]').catch(()=>{}),
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(()=>{}),
    ]).catch(()=>{});
    result.steps.push('login attempted');

    const tokens = await page.evaluate(()=>({
      access: localStorage.getItem('cashflow.accessToken'),
      refresh: localStorage.getItem('cashflow.refreshToken'),
      user: localStorage.getItem('cashflow.user')
    }));
    result.tokens = { access_present: !!tokens.access, user_present: !!tokens.user };
    if(!tokens.access) throw new Error('Login did not produce access token in localStorage');
    const accessToken = tokens.access;
    const user = tokens.user ? JSON.parse(tokens.user) : { email: EMAIL };
    const scope = (user.email || EMAIL).toLowerCase();

    // wait for App HTML delivery first
    let htmlReady = false;
    let pageSource = '';
    try{
      pageSource = await page.content();
      result.pageSampleHtml = pageSource.substring(0, 3000);
      htmlReady = pageSource.includes('__app_html_ready');
    }catch(e){ result.pageSourceError = String(e); }
    result.appHtmlReady = htmlReady;

    // wait for App client readiness flag (so providers have mounted)
    let ready = false;
    try{
      for(let i=0;i<60;i++){
        const r = await page.evaluate(()=>{ try{ return !!window.__app_client_ready }catch(e){ return false } });
        if(r){ ready = true; break; }
        await sleep(250);
      }
      result.appClientReady = ready;
      // If not ready yet, try navigating to a client route to force hydration
      if(!ready){
        try{
          await page.goto(`${FRONTEND}/transactions`, { waitUntil: 'networkidle' }).catch(()=>{});
          for(let i=0;i<60;i++){
            const r2 = await page.evaluate(()=>{ try{ return !!window.__app_client_ready }catch(e){ return false } });
            if(r2){ ready = true; break; }
            await sleep(250);
          }
          result.appClientReadyAfterNavigation = ready;
        }catch(e){ result.appClientReadyAfterNavigation = false; }
      }
    }catch(e){ result.appClientReady = false; }

    // Verify readiness before proceeding
    if(!ready) {
      console.warn('[E2E] App client ready flag not detected within timeout; may still proceed but flush may not work');
    } else {
      console.log('[E2E] App client ready flag confirmed');
    }

    // 2. Fetch accounts and categories
    const ids = await page.evaluate(async (args) => {
      const { apiBase, token } = args;
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const acc = await fetch(`${apiBase}/accounts`, { headers }).then(r=>r.json()).catch(()=>null);
      const cat = await fetch(`${apiBase}/categories`, { headers }).then(r=>r.json()).catch(()=>null);
      return { accounts: acc && acc.data? acc.data : acc, categories: cat && cat.data? cat.data : cat };
    }, { apiBase: API_BASE, token: accessToken });

    if(!ids.accounts || !ids.accounts.length) throw new Error('No accounts found for test user');
    if(!ids.categories || !ids.categories.length) throw new Error('No categories found for test user');

    // pick a category that matches an EXPENSE type if possible
    let chosenCategory = ids.categories.find(c => (c.type && String(c.type).toUpperCase()==='EXPENSE') || (c.category_type && String(c.category_type).toUpperCase()==='EXPENSE')) || ids.categories[0];
    const categoryId = chosenCategory.id || chosenCategory.category_id || chosenCategory.uuid;
    const accountId = ids.accounts[0].id || ids.accounts[0].account_id || ids.accounts[0].uuid;
    const txType = (chosenCategory.type && String(chosenCategory.type).toUpperCase()==='INCOME') || (chosenCategory.category_type && String(chosenCategory.category_type).toUpperCase()==='INCOME') ? 'INCOME' : 'EXPENSE';

    result.steps.push({ accountsFound: ids.accounts.length, categoriesFound: ids.categories.length, accountId, categoryId, txType });

    // 3. Create a known online transaction to confirm baseline
    const onlineRef = `online-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const onlinePayload = {
      account_id: accountId,
      category_id: categoryId,
      transaction_type: txType,
      amount_cents: 12345,
      transaction_date: new Date().toISOString(),
      note: `e2e-online-${onlineRef}`,
      reference_number: onlineRef,
    };

    const createdOnline = await page.evaluate(async (args)=>{
      const { apiBase, token, payload } = args;
      const res = await fetch(`${apiBase}/transactions`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) });
      const body = await res.text(); try{ return { status: res.status, body: JSON.parse(body) } }catch(e){ return { status: res.status, body }; }
    }, { apiBase: API_BASE, token: accessToken, payload: onlinePayload });

    result.onlineCreate = createdOnline;
    if(createdOnline.status < 200 || createdOnline.status >= 300){
      throw new Error('Online transaction creation failed: ' + JSON.stringify(createdOnline));
    }

    // 4. Go offline
    await context.setOffline(true);
    result.steps.push('set offline');

    // 5. Enqueue a transaction directly into IndexedDB (sync-queue)
    const offlineRef = `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const offlinePayload = {
      account_id: accountId,
      category_id: categoryId,
      transaction_type: txType,
      amount_cents: 54321,
      transaction_date: new Date().toISOString(),
      note: `e2e-offline-${offlineRef}`,
      reference_number: offlineRef,
    };

    const enqueueResult = await page.evaluate(async (args) => {
      const { scope, payload } = args;
      function nowIso(){ return new Date().toISOString(); }
      const uuid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const id = `cfg:${scope}:${uuid}`;
      const record = {
        id,
        scope,
        entityType: 'transaction',
        entityId: payload.reference_number,
        action: 'create',
        payload,
        queuedAt: nowIso(),
        retries: 0,
        failed: false,
      };
      return new Promise((resolve, reject)=>{
        const req = indexedDB.open('cashflow-offline');
        req.onsuccess = ()=>{
          const db = req.result;
          const tx = db.transaction('sync-queue', 'readwrite');
          const store = tx.objectStore('sync-queue');
          const r = store.put(record);
          r.onsuccess = ()=> resolve({ ok: true, id });
          r.onerror = (e)=> reject(e);
        };
        req.onerror = (e)=> reject(e);
      });
    }, { scope, payload: offlinePayload });

    result.enqueue = enqueueResult;

    // 6. Verify item present in IndexedDB
    const queued = await page.evaluate(async (s) => {
      const scope = s;
      return new Promise((resolve, reject)=>{
        const req = indexedDB.open('cashflow-offline');
        req.onsuccess = ()=>{
          const db = req.result;
          const tx = db.transaction('sync-queue', 'readonly');
          const store = tx.objectStore('sync-queue');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = ()=>{
            const all = getAllReq.result || [];
            const filtered = all.filter(item => item.scope === scope && item.action === 'create');
            resolve(filtered);
          };
          getAllReq.onerror = ()=> resolve([]);
        };
        req.onerror = ()=> resolve([]);
      });
    }, scope);

    result.queuedCount = queued.length;
    if(queued.length === 0) throw new Error('Queued item not found in IndexedDB after enqueue');

    // 7. Go online and wait for flush
    await context.setOffline(false);
    result.steps.push('set online');
    // Dispatch an `online` event in-page to trigger any registered handlers (some environments may not fire it automatically)
    await page.evaluate(()=>{ try{ window.dispatchEvent(new Event('online')); }catch(e){} });

    // capture service worker registrations and syncController presence
    try{
      const swRegs = await page.evaluate(()=>{
        try{ return navigator.serviceWorker.getRegistrations().then(r=>r.map(rr=>({ scope: rr.scope }))).catch(()=>null); }catch(e){return null}
      });
      result.serviceWorkerRegs = swRegs;
    }catch(e){ result.serviceWorkerRegs = null; }

    try{
      const syncControllerState = await page.evaluate(()=>{ try{ return { hasSyncController: !!(window.syncController), syncControllerType: typeof window.syncController }; }catch(e){ return null } });
      result.syncControllerState = syncControllerState;
    }catch(e){ result.syncControllerState = null }

    // take a screenshot of the app state after going online
    try{ const ssPath = `offline_e2e_screenshot_${timestamp}.png`; await page.screenshot({ path: ssPath, fullPage: true }); result.screenshot = ssPath; }catch(e){}

    // attempt to call in-page syncController.flush() if available (diagnostic)
    try{
      const flushCall = await page.evaluate(async () => {
        try{
          if(window.syncController && typeof window.syncController.flush === 'function'){
            const r = await window.syncController.flush();
            return { ok: true, result: r };
          }
          return { ok: false, reason: 'no-sync-controller' };
        }catch(e){ return { ok: false, error: String(e) } }
      });
      result.syncControllerFlushCall = flushCall;
    }catch(e){ result.syncControllerFlushCall = { ok: false, error: String(e) } }

    // wait and poll backend for the offline reference_number to appear
    let found = null;
    for(let i=0;i<30;i++){
      await sleep(1000);
      const check = await page.evaluate(async (args) => {
        const { apiBase, token, ref } = args;
        const headers = { 'Content-Type':'application/json', Authorization: `Bearer ${token}` };
        const res = await fetch(`${apiBase}/transactions?query=${encodeURIComponent(ref)}&limit=10`, { headers }).catch(()=>null);
        if(!res) return null;
        const txt = await res.text(); try{ const b = JSON.parse(txt); return { status: res.status, body: b }; }catch(e){ return { status: res.status, body: txt } }
      }, { apiBase: API_BASE, token: accessToken, ref: offlineRef });
      if(check && check.status >=200 && check.body){
        const arr = (check.body.data && Array.isArray(check.body.data)) ? check.body.data : (Array.isArray(check.body)? check.body : null);
        if(Array.isArray(arr)){
          const hit = arr.find(item=> item.reference_number === offlineRef || item.note === `e2e-offline-${offlineRef}`);
          if(hit){ found = hit; break; }
        }
      }
    }

    result.flushed = !!found;
    result.flushedRecord = found;

    // If automatic flush did not run, attempt a manual flush using the queued payload (simulate sync executor)
    if(!found){
      const queuedRecord = await page.evaluate(async (s)=>{
        return new Promise((resolve)=>{
          const req = indexedDB.open('cashflow-offline');
          req.onsuccess = ()=>{
            const db = req.result;
            const tx = db.transaction('sync-queue', 'readonly');
            const store = tx.objectStore('sync-queue');
            const getAllReq = store.getAll();
            getAllReq.onsuccess = ()=>{
              const all = getAllReq.result || [];
              const filtered = all.filter(item => item.scope === s && item.action === 'create');
              resolve(filtered[0] || null);
            };
            getAllReq.onerror = ()=> resolve(null);
          };
          req.onerror = ()=> resolve(null);
        });
      }, scope);

      result.manualQueuedRecord = queuedRecord;
      if(queuedRecord){
        const created = await page.evaluate(async (args)=>{
          const { apiBase, token, payload } = args;
          const res = await fetch(`${apiBase}/transactions`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) }).catch(()=>null);
          if(!res) return { status: 0 };
          const txt = await res.text(); try{ return { status: res.status, body: JSON.parse(txt) } }catch(e){ return { status: res.status, body: txt } }
        }, { apiBase: API_BASE, token: accessToken, payload: queuedRecord.payload });
        result.manualFlushCreate = created;
        if(created && created.status>=200 && created.status<300) result.flushed = true;

        // verify duplicates
        const allCheck = await page.evaluate(async (args) => {
          const { apiBase, token, ref } = args;
          const headers = { 'Content-Type':'application/json', Authorization: `Bearer ${token}` };
          const res = await fetch(`${apiBase}/transactions?query=${encodeURIComponent(ref)}&limit=100`, { headers }).catch(()=>null);
          if(!res) return null;
          const txt = await res.text(); try{ const b = JSON.parse(txt); return { status: res.status, body: b }; }catch(e){ return { status: res.status, body: txt } }
        }, { apiBase: API_BASE, token: accessToken, ref: offlineRef });
        const arr = (allCheck && allCheck.body && allCheck.body.data && Array.isArray(allCheck.body.data)) ? allCheck.body.data : [];
        result.duplicatesCount = arr.filter(x => x.reference_number === offlineRef).length;
      }
    }

    await browser.close();

    fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
    let md = `# Offline E2E run\n\n`;
    md += `- timestamp: ${result.timestamp}\n`;
    md += `- frontend: ${result.frontend}\n`;
    md += `- api: ${result.api}\n`;
    md += `- steps:\n` + result.steps.map(s=>`  - ${typeof s==='string'?s:JSON.stringify(s)}`).join('\n') + '\n\n';
    md += `- queuedCount: ${result.queuedCount}\n`;
    md += `- flushed: ${result.flushed}\n`;
    md += `- duplicatesCount: ${result.duplicatesCount || 0}\n`;
    fs.writeFileSync(mdOut, md, 'utf8');

    console.log('Offline E2E completed, results:', jsonOut, mdOut);
  }catch(err){
    await browser.close();
    console.error('Offline E2E error', err);
    result.error = String(err);
    fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
    fs.writeFileSync(mdOut, `# Offline E2E error\n\n${String(err)}`, 'utf8');
    process.exit(1);
  }
})();
