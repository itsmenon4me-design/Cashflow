const { chromium } = require('playwright');

(async () => {
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // login first
    await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', process.env.TEST_USER_EMAIL || 'admin@cashflow.local').catch(()=>{});
    await page.fill('#password', process.env.TEST_USER_PASS || 'admin123').catch(()=>{});
    await page.click('button[type="submit"]').catch(()=>{});
    // wait for access token
    let accessToken = null;
    for(let i=0;i<40;i++){
      const t = await page.evaluate(()=>({ access: localStorage.getItem('cashflow.accessToken'), user: localStorage.getItem('cashflow.user') }));
      if(t && t.access){ accessToken = t.access; break; }
      await new Promise(r=>setTimeout(r,250));
    }
    if(!accessToken){
      const fs = require('fs'); fs.writeFileSync('D:/Project 2/CashFlow/apps/backend/recovery_reports/evidence/phase_f/f2_income_ui_smoke_debug.html', await page.content());
      console.log('login failed'); await browser.close(); process.exit(2);
    }

    await page.goto(`${FRONTEND}/incomes`, { waitUntil: 'networkidle' });
    // save debug HTML
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('D:/Project 2/CashFlow/apps/backend/recovery_reports/evidence/phase_f/f2_income_ui_smoke_debug.html', html);

    // check that transaction form is NOT visible by default
    const formVisible = await page.isVisible('#transaction-date').catch(() => false);
    console.log('formVisibleByDefault=', formVisible);
    // click add button
    const addBtn = await page.waitForSelector(
      'button:has-text("Tambah Pemasukan"), button:has-text("Tambah Transaksi"), button:has-text("Add Transaction"), button:has-text("Tambah"), button:has-text("Add"), button:has-text("+ Tambah Pemasukan")',
      { timeout: 5000 },
    ).catch(()=>null);
    if (!addBtn) {
      console.log('add button not found');
      await browser.close();
      process.exit(2);
    }
    await addBtn.click();
    // wait for form to appear
    const formVisibleAfter = await page.waitForSelector('#transaction-date', { timeout: 5000 }).then(()=>true).catch(()=>false);
    console.log('formVisibleAfterClick=', formVisibleAfter);
    await browser.close();
    process.exit(formVisible || !formVisibleAfter ? 3 : 0);
  } catch (e) {
    console.error(e);
    await browser.close();
    process.exit(1);
  }
})();