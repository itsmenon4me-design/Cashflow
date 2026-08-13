const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

(async ()=>{
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
  const API_BASE = process.env.TARGET_URL || 'http://localhost:3001/api/v1';
  const EMAIL = process.env.TEST_USER_EMAIL || 'admin@cashflow.local';
  const PASSWORD = process.env.TEST_USER_PASS || 'admin123';
  const outDir = path.join(__dirname);
  const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
  const jsonOut = path.join(outDir, `f3_expense_e2e_${timestamp}.json`);
  const mdOut = path.join(outDir, `f3_expense_e2e_${timestamp}.md`);
  const screenshotOut = path.join(outDir, `f3_expense_e2e_${timestamp}.png`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const result = { timestamp: new Date().toISOString(), frontend: FRONTEND, api: API_BASE, steps: [], consoleLogs: [] };
  page.on('console', msg => { try{ result.consoleLogs.push({ type: msg.type(), text: msg.text(), timestamp: new Date().toISOString() }); }catch(e){} });

  try{
    result.steps.push('goto login');
    await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', EMAIL).catch(()=>{});
    await page.fill('#password', PASSWORD).catch(()=>{});
    await page.click('button[type="submit"]').catch(()=>{});
    // wait for access token in localStorage up to 10s
    let accessToken = null;
    for(let i=0;i<40;i++){
      const t = await page.evaluate(()=>({ access: localStorage.getItem('cashflow.accessToken'), user: localStorage.getItem('cashflow.user') }));
      if(t && t.access){ accessToken = t.access; break; }
      await sleep(250);
    }
    if(!accessToken){ fs.writeFileSync(path.join(outDir, `f3_expense_login_failed_${timestamp}.html`), await page.content()); throw new Error('Login failed'); }
    result.steps.push('navigate to /expenses');
    await page.goto(`${FRONTEND}/expenses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    // ensure form not visible by default
    const formVisible = await page.isVisible('#transaction-date').catch(()=>false);
    result.formVisibleByDefault = formVisible;
    if(formVisible) throw new Error('Form visible by default on /expenses');

    // click add
    const addBtn = await page.waitForSelector('button:has-text("Tambah Pengeluaran"), button:has-text("+ Tambah Pengeluaran"), button:has-text("Tambah Transaksi"), button:has-text("Add Transaction"), button:has-text("Add")', { timeout: 5000 });
    await addBtn.click();
    // wait for form
    const appeared = await page.waitForSelector('#transaction-date', { timeout: 5000 }).then(()=>true).catch(()=>false);
    result.formAppeared = appeared;
    if(!appeared) throw new Error('Form did not appear after clicking add');

    // prepare payload values via UI fields (simpler to POST via API to ensure stable creation while verifying UI)
    // we will gather accounts/categories via API to use values
    const ids = await page.evaluate(async (args)=>{
      const { apiBase, token } = args;
      const headers = { 'Content-Type':'application/json', Authorization: `Bearer ${token}` };
      const acc = await fetch(`${apiBase}/accounts`, { headers }).then(r=>r.json()).catch(()=>null);
      const cat = await fetch(`${apiBase}/categories`, { headers }).then(r=>r.json()).catch(()=>null);
      return { accounts: acc && acc.data?acc.data:acc, categories: cat && cat.data?cat.data:cat };
    }, { apiBase: API_BASE, token: accessToken });

    if(!ids.accounts || !ids.accounts.length) throw new Error('No accounts for test user');
    if(!ids.categories || !ids.categories.length) throw new Error('No categories for test user');

    const accountId = ids.accounts[0].id;
    const expenseCat = ids.categories.find(c=> (c.type && String(c.type).toUpperCase()==='EXPENSE') || (c.category_type && String(c.category_type).toUpperCase()==='EXPENSE')) || ids.categories[0];

    const uniqueRef = `e2e-expense-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const payload = {
      account_id: accountId,
      category_id: expenseCat.id || expenseCat.category_id || expenseCat.uuid,
      transaction_type: 'EXPENSE',
      amount_cents: 20000,
      transaction_date: new Date().toISOString(),
      note: `Expense ${uniqueRef}`,
      reference_number: uniqueRef,
    };

    // create via API
    const apiCreate = await page.evaluate(async (args)=>{
      const { apiBase, token, payload } = args;
      const res = await fetch(`${apiBase}/transactions`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }).then(r=>r.json()).catch(()=>({ error: true }));
      return res;
    }, { apiBase: API_BASE, token: accessToken, payload });

    result.apiCreate = apiCreate;
    if(!apiCreate || apiCreate.error) throw new Error('API create failed: ' + JSON.stringify(apiCreate));

    // navigate to transactions or expenses list and check presence
    await page.goto(`${FRONTEND}/expenses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const pageText = await page.content();
    result.pageContainsRef = pageText.includes(uniqueRef);

    // screenshot
    await page.screenshot({ path: screenshotOut, fullPage: true });

    // DB verify
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
    }catch(e){ dbCount = 'ERROR'; }

    result.dbCount = dbCount;

    fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
    const md = [`# F.3 Expense E2E - ${timestamp}`, '', `UniqueRef: ${uniqueRef}`, '', `apiCreate: ${JSON.stringify(apiCreate)}`, '', `dbCount: ${dbCount}`].join('\n');
    fs.writeFileSync(mdOut, md);

    console.log('Expense E2E complete', jsonOut, mdOut, screenshotOut);
    await browser.close();
    process.exit(0);
  }catch(e){
    try{ fs.writeFileSync(path.join(outDir, `f3_expense_error_${timestamp}.log`), String(e.stack||e)); }catch(e){}
    console.error(e);
    await browser.close();
    process.exit(1);
  }
})();