# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: currency-sync.spec.ts >> currency change in settings syncs to dashboard (localStorage + API)
- Location: playwright-tests\currency-sync.spec.ts:33:5

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e3]:
    - complementary [ref=f2e4]:
      - generic [ref=f2e10]:
        - paragraph [ref=f2e11]: CashFlow
        - paragraph [ref=f2e12]: Sistem keuangan pribadi
      - navigation "Buka menu navigasi" [ref=f2e16]:
        - generic [ref=f2e17]:
          - paragraph [ref=f2e18]: Utama
          - link "Beranda" [ref=f2e20] [cursor=pointer]:
            - /url: /dashboard
        - generic [ref=f2e25]:
          - button "Ciutkan Keuangan" [expanded] [ref=f2e26] [cursor=pointer]: Keuangan
          - generic [ref=f2e29]:
            - link "Akun" [ref=f2e30] [cursor=pointer]:
              - /url: /accounts
            - link "Pemasukan" [ref=f2e34] [cursor=pointer]:
              - /url: /incomes
            - link "Pengeluaran" [ref=f2e38] [cursor=pointer]:
              - /url: /expenses
            - link "Transaksi" [ref=f2e42] [cursor=pointer]:
              - /url: /transactions
            - link "Kategori" [ref=f2e46] [cursor=pointer]:
              - /url: /categories
        - generic [ref=f2e50]:
          - button "Ciutkan Perencanaan" [expanded] [ref=f2e51] [cursor=pointer]: Perencanaan
          - generic [ref=f2e54]:
            - link "Anggaran" [ref=f2e55] [cursor=pointer]:
              - /url: /budgets
            - link "Target Tabungan" [ref=f2e60] [cursor=pointer]:
              - /url: /goals
            - link "Investasi" [ref=f2e66] [cursor=pointer]:
              - /url: /investments
        - generic [ref=f2e71]:
          - button "Ciutkan Analisis & Insight" [expanded] [ref=f2e72] [cursor=pointer]: Analisis & Insight
          - generic [ref=f2e75]:
            - link "Perkiraan Keuangan" [ref=f2e76] [cursor=pointer]:
              - /url: /forecast
            - link "Laporan" [ref=f2e81] [cursor=pointer]:
              - /url: /reports
            - link "Analitik" [ref=f2e86] [cursor=pointer]:
              - /url: /analytics
        - generic [ref=f2e90]:
          - button "Ciutkan Sistem" [expanded] [ref=f2e91] [cursor=pointer]: Sistem
          - generic [ref=f2e94]:
            - link "Notifikasi" [ref=f2e95] [cursor=pointer]:
              - /url: /notifications
            - link "Audit Log" [ref=f2e100] [cursor=pointer]:
              - /url: /audit-log
            - link "Pengaturan" [ref=f2e105] [cursor=pointer]:
              - /url: /settings
      - button "Ciutkan Menu" [ref=f2e111]
    - generic [ref=f2e113]:
      - banner [ref=f2e114]:
        - generic [ref=f2e115]:
          - textbox "Pencarian global" [ref=f2e117]:
            - /placeholder: Cari transaksi, akun, wawasan, kategori, anggaran, target, investasi, notifikasi...
          - generic [ref=f2e118]:
            - generic [ref=f2e119]: Sabtu, 22 Agustus 2026
            - status "Synced" [ref=f2e123]
            - button "Notifikasi" [ref=f2e127]:
              - generic: "10"
            - button "Ganti ke mode terang" [ref=f2e128]
            - combobox [ref=f2e130]:
              - generic: IDR
            - button "U e2e.api.user@test.local" [ref=f2e131]:
              - generic [ref=f2e132]: U
              - generic [ref=f2e134]:
                - paragraph
                - paragraph [ref=f2e135]: e2e.api.user@test.local
      - main [ref=f2e136]:
        - generic [ref=f2e139]:
          - generic [ref=f2e140]:
            - heading "Selamat sore, Pengguna" [level=1] [ref=f2e141]
            - paragraph [ref=f2e142]: Berikut ringkasan keuangan Anda bulan ini.
          - generic [ref=f2e143]:
            - generic [ref=f2e144]:
              - generic [ref=f2e146]:
                - paragraph [ref=f2e147]: Saldo Saat Ini
                - paragraph [ref=f2e149]: "-Rp309.500"
              - generic [ref=f2e155]:
                - generic [ref=f2e156]: +4,2%
                - generic [ref=f2e160]: vs bulan lalu
            - generic [ref=f2e164]:
              - generic [ref=f2e166]:
                - paragraph [ref=f2e167]: Total Pemasukan
                - paragraph [ref=f2e169]: Rp0
              - generic [ref=f2e174]:
                - generic [ref=f2e175]: +8,1%
                - generic [ref=f2e179]: vs bulan lalu
            - generic [ref=f2e183]:
              - generic [ref=f2e185]:
                - paragraph [ref=f2e186]: Total Pengeluaran
                - paragraph [ref=f2e188]: Rp499.500
              - generic [ref=f2e193]:
                - generic [ref=f2e194]: "-2,4%"
                - generic [ref=f2e198]: vs bulan lalu
            - generic [ref=f2e202]:
              - generic [ref=f2e204]:
                - paragraph [ref=f2e205]: Arus Kas
                - paragraph [ref=f2e207]: "-Rp499.500"
              - generic [ref=f2e216]:
                - generic [ref=f2e217]: +12,8%
                - generic [ref=f2e221]: vs bulan lalu
          - generic [ref=f2e225]:
            - generic [ref=f2e226]:
              - generic [ref=f2e227]:
                - generic [ref=f2e228]:
                  - generic [ref=f2e229]: Arus Kas Bulanan
                  - paragraph [ref=f2e230]: Tren bulanan
                - generic [ref=f2e231]: Saldo
              - application [ref=f2e237]:
                - generic [ref=f2e244]:
                  - generic [ref=f2e245]: Aug
                  - generic [ref=f2e248]:
                    - generic [ref=f2e249]: "-Rp 499,5 rb"
                    - generic [ref=f2e251]: "-Rp 499,5 rb"
                    - generic [ref=f2e253]: "-Rp 499,5 rb"
                    - generic [ref=f2e255]: "-Rp 499,5 rb"
                    - generic [ref=f2e257]: "-Rp 499,5 rb"
            - generic [ref=f2e259]:
              - generic [ref=f2e260]: Kategori Pengeluaran
              - generic [ref=f2e262]:
                - application [ref=f2e266]
                - generic [ref=f2e267]:
                  - generic [ref=f2e271]:
                    - generic [ref=f2e272]:
                      - generic "Other Expense" [ref=f2e273]
                      - generic [ref=f2e274]: 100%
                    - generic [ref=f2e275]: Rp499.500
                  - link "Lihat Semua" [ref=f2e277] [cursor=pointer]:
                    - /url: /categories
          - generic [ref=f2e278]:
            - generic [ref=f2e279]:
              - generic [ref=f2e280]:
                - generic [ref=f2e281]: Target Bulan Ini
                - button "Ciutkan" [expanded] [ref=f2e283]
              - paragraph [ref=f2e285]: Belum ada data.
            - generic [ref=f2e286]:
              - link "Target Tabungan" [ref=f2e287] [cursor=pointer]:
                - /url: /goals
                - generic [ref=f2e288]:
                  - generic [ref=f2e289]:
                    - generic [ref=f2e290]: Target Tabungan
                    - paragraph [ref=f2e295]: Progres target tabungan aktif.
                  - generic [ref=f2e296]:
                    - paragraph [ref=f2e299]: 0%
                    - generic [ref=f2e300]:
                      - generic [ref=f2e301]:
                        - paragraph [ref=f2e302]: Target
                        - paragraph [ref=f2e303]: Rp0
                      - generic [ref=f2e304]:
                        - paragraph [ref=f2e305]: Terkumpul
                        - paragraph [ref=f2e306]: Rp0
                      - generic [ref=f2e307]:
                        - paragraph [ref=f2e308]: Sisa
                        - paragraph [ref=f2e309]: Rp0
                    - paragraph [ref=f2e310]: 0 selesai
              - generic [ref=f2e313]:
                - generic [ref=f2e314]:
                  - generic [ref=f2e315]: Ringkasan Investasi
                  - paragraph [ref=f2e316]: Total aset, profit, dan komposisi portofolio.
                - generic [ref=f2e317]:
                  - generic [ref=f2e318]:
                    - paragraph [ref=f2e319]: Nilai Saat Ini
                    - paragraph [ref=f2e320]: Rp0
                  - generic [ref=f2e321]:
                    - generic [ref=f2e322]:
                      - paragraph [ref=f2e323]: Total Profit
                      - paragraph [ref=f2e324]: Rp0
                    - generic [ref=f2e325]:
                      - paragraph [ref=f2e326]: Total Loss
                      - paragraph [ref=f2e327]: Rp0
                    - generic [ref=f2e328]:
                      - paragraph [ref=f2e329]: ROI
                      - paragraph [ref=f2e330]: 0.0%
                  - generic [ref=f2e331]:
                    - generic [ref=f2e332]: Alokasi per Jenis
                    - paragraph [ref=f2e335]: Belum ada data.
          - generic [ref=f2e336]:
            - generic [ref=f2e337]:
              - generic [ref=f2e338]:
                - generic [ref=f2e339]:
                  - generic [ref=f2e340]: Pemasukan vs Pengeluaran
                  - paragraph [ref=f2e341]: Tren bulanan
                - generic [ref=f2e342]: PemasukanPengeluaran
              - application [ref=f2e349]:
                - generic [ref=f2e360]:
                  - generic [ref=f2e361]: Aug
                  - generic [ref=f2e364]:
                    - generic [ref=f2e365]: Rp 0
                    - generic [ref=f2e367]: Rp 150 rb
                    - generic [ref=f2e369]: Rp 300 rb
                    - generic [ref=f2e371]: Rp 450 rb
                    - generic [ref=f2e373]: Rp 600 rb
            - generic [ref=f2e375]:
              - generic [ref=f2e376]:
                - generic [ref=f2e377]: Kesehatan Keuangan
                - paragraph [ref=f2e378]: Indikator sederhana dari data transaksi Anda.
              - generic [ref=f2e379]:
                - generic [ref=f2e380]:
                  - generic [ref=f2e381]:
                    - paragraph [ref=f2e382]: Skor
                    - paragraph [ref=f2e383]: "0"
                  - generic [ref=f2e384]: Berisiko
                - generic [ref=f2e388]:
                  - generic [ref=f2e389]: Risk
                  - generic [ref=f2e390]: 0/100
                - generic [ref=f2e391]:
                  - generic [ref=f2e392]:
                    - term [ref=f2e393]: Saving Rate
                    - definition [ref=f2e394]: 0.0%
                  - generic [ref=f2e395]:
                    - term [ref=f2e396]: Rasio Pengeluaran
                    - definition [ref=f2e397]: 100.0%
                  - generic [ref=f2e398]:
                    - term [ref=f2e399]: Pemasukan vs Pengeluaran
                    - definition [ref=f2e400]: 0.00x
                  - generic [ref=f2e401]:
                    - term [ref=f2e402]: Konsentrasi Pengeluaran
                    - definition [ref=f2e403]: 100.0%
                  - generic [ref=f2e404]:
                    - term [ref=f2e405]: Arus Kas Bersih
                    - definition [ref=f2e406]: "-Rp499.500"
          - generic [ref=f2e407]:
            - generic [ref=f2e409]:
              - generic [ref=f2e410]:
                - generic [ref=f2e411]: Transaksi Terbaru
                - paragraph [ref=f2e412]: Diperbarui baru saja
              - generic [ref=f2e413]:
                - textbox "Pencarian global" [ref=f2e415]:
                  - /placeholder: Cari transaksi...
                - button "Filter" [ref=f2e416]
            - generic [ref=f2e417]:
              - table [ref=f2e420]:
                - rowgroup [ref=f2e421]:
                  - row [ref=f2e422]:
                    - columnheader "Tanggal" [ref=f2e423]
                    - columnheader "Kategori" [ref=f2e424]
                    - columnheader "Deskripsi" [ref=f2e425]
                    - columnheader "Jumlah" [ref=f2e426]
                    - columnheader "Status" [ref=f2e427]
                    - columnheader "Aksi" [ref=f2e428]
                - rowgroup [ref=f2e429]:
                  - row [ref=f2e430]:
                    - cell "Aug 18, 2026 • 07:00" [ref=f2e431]
                    - cell "Pengeluaran Lainnya" [ref=f2e432]
                    - cell "E2E search target E2E-search-1787367081033" [ref=f2e434]
                    - cell "-Rp 55.500" [ref=f2e435]
                    - cell "Berhasil" [ref=f2e436]
                    - cell [ref=f2e438]:
                      - button "Aksi E2E search target E2E-search-1787367081033" [ref=f2e439]
                  - row [ref=f2e440]:
                    - cell "Aug 18, 2026 • 07:00" [ref=f2e441]
                    - cell "Pengeluaran Lainnya" [ref=f2e442]
                    - cell "E2E search target E2E-search-1787351604435" [ref=f2e444]
                    - cell "-Rp 55.500" [ref=f2e445]
                    - cell "Berhasil" [ref=f2e446]
                    - cell [ref=f2e448]:
                      - button "Aksi E2E search target E2E-search-1787351604435" [ref=f2e449]
                  - row [ref=f2e450]:
                    - cell "Aug 18, 2026 • 07:00" [ref=f2e451]
                    - cell "Pengeluaran Lainnya" [ref=f2e452]
                    - cell "E2E search target E2E-search-1787351559857" [ref=f2e454]
                    - cell "-Rp 55.500" [ref=f2e455]
                    - cell "Berhasil" [ref=f2e456]
                    - cell [ref=f2e458]:
                      - button "Aksi E2E search target E2E-search-1787351559857" [ref=f2e459]
                  - row [ref=f2e460]:
                    - cell "Aug 18, 2026 • 07:00" [ref=f2e461]
                    - cell "Pengeluaran Lainnya" [ref=f2e462]
                    - cell "E2E search target E2E-search-1787351509126" [ref=f2e464]
                    - cell "-Rp 55.500" [ref=f2e465]
                    - cell "Berhasil" [ref=f2e466]
                    - cell [ref=f2e468]:
                      - button "Aksi E2E search target E2E-search-1787351509126" [ref=f2e469]
                  - row [ref=f2e470]:
                    - cell "Aug 18, 2026 • 07:00" [ref=f2e471]
                    - cell "Pengeluaran Lainnya" [ref=f2e472]
                    - cell "E2E search target E2E-search-1787389291648" [ref=f2e474]
                    - cell "-Rp 55.500" [ref=f2e475]
                    - cell "Berhasil" [ref=f2e476]
                    - cell [ref=f2e478]:
                      - button "Aksi E2E search target E2E-search-1787389291648" [ref=f2e479]
              - generic [ref=f2e480]:
                - paragraph [ref=f2e481]: Menampilkan 1–5 dari 5
                - generic [ref=f2e482]:
                  - button "Sebelumnya" [disabled]
                  - generic [ref=f2e483]: Halaman 1 dari 1
                  - button "Berikutnya" [disabled]
          - generic [ref=f2e484]:
            - generic [ref=f2e485]:
              - generic [ref=f2e486]:
                - generic [ref=f2e487]: Aktivitas Terbaru
                - button "Ciutkan" [expanded] [ref=f2e489]
              - generic [ref=f2e490]:
                - list [ref=f2e491]:
                  - listitem [ref=f2e492]:
                    - generic [ref=f2e499]:
                      - paragraph [ref=f2e500]: Login
                      - paragraph [ref=f2e501]: Baru saja
                  - listitem [ref=f2e502]:
                    - generic [ref=f2e509]:
                      - paragraph [ref=f2e510]: Login
                      - paragraph [ref=f2e511]: Baru saja
                  - listitem [ref=f2e512]:
                    - generic [ref=f2e519]:
                      - paragraph [ref=f2e520]: Login
                      - paragraph [ref=f2e521]: 1 mnt lalu
                  - listitem [ref=f2e522]:
                    - generic [ref=f2e529]:
                      - paragraph [ref=f2e530]: Login
                      - paragraph [ref=f2e531]: 2 mnt lalu
                  - listitem [ref=f2e532]:
                    - generic [ref=f2e537]:
                      - paragraph [ref=f2e538]: Transaksi dibuat
                      - paragraph [ref=f2e539]: 4 mnt lalu
                  - listitem [ref=f2e540]:
                    - generic [ref=f2e547]:
                      - paragraph [ref=f2e548]: Login
                      - paragraph [ref=f2e549]: 4 mnt lalu
                  - listitem [ref=f2e550]:
                    - generic [ref=f2e557]:
                      - paragraph [ref=f2e558]: Login
                      - paragraph [ref=f2e559]: 4 mnt lalu
                  - listitem [ref=f2e560]:
                    - generic [ref=f2e567]:
                      - paragraph [ref=f2e568]: Login
                      - paragraph [ref=f2e569]: 4 mnt lalu
                  - listitem [ref=f2e570]:
                    - generic [ref=f2e575]:
                      - paragraph [ref=f2e576]: Transaksi dibuat
                      - paragraph [ref=f2e577]: 17 mnt lalu
                  - listitem [ref=f2e578]:
                    - generic [ref=f2e584]:
                      - paragraph [ref=f2e585]: Login
                      - paragraph [ref=f2e586]: 17 mnt lalu
                - link "Lihat semua aktivitas" [ref=f2e587] [cursor=pointer]:
                  - /url: /audit-log
            - generic [ref=f2e590]:
              - generic [ref=f2e592]:
                - generic [ref=f2e593]: Wawasan AI
                - paragraph [ref=f2e594]: Konteks IDR
              - generic [ref=f2e598]:
                - generic [ref=f2e599]: "Konteks IDR: dashboard Anda tetap selaras dengan preferensi tampilan aktif."
                - generic [ref=f2e600]: "Konteks IDR: kartu ringkasan mencerminkan konteks tampilan tanpa mengubah data akun."
  - alert [ref=f2e601]
  - generic [ref=f2e602]: Rp 0
```

# Test source

```ts
  101 |       Storage.prototype.setItem = function (k: string, v: string) {
  102 |         try {
  103 |           if (k === 'cashflow.accessToken' || k === 'cashflow.refreshToken') {
  104 |             const t = v ?? '';
  105 |             const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
  106 |             // Use console.log so existing page.on('console') collector captures it.
  107 |             // Timestamp in ms since epoch is sufficient for ordering comparisons.
  108 |             // eslint-disable-next-line no-console
  109 |             console.log('[token-set]', JSON.stringify({ key: k, ts: Date.now(), token: masked }));
  110 |           }
  111 |         } catch (e) {}
  112 |         return origSet.apply(this, arguments as any);
  113 |       };
  114 | 
  115 |       const origFetch = window.fetch.bind(window);
  116 |       window.fetch = function (resource: RequestInfo, init?: RequestInit) {
  117 |         try {
  118 |           const url = typeof resource === 'string' ? resource : resource?.toString() || '';
  119 |           if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search')) {
  120 |             const t = localStorage.getItem('cashflow.accessToken') || '';
  121 |             const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
  122 |             // eslint-disable-next-line no-console
  123 |             console.log('[req-sent]', JSON.stringify({ url, ts: Date.now(), token: masked }));
  124 |           }
  125 |         } catch (e) {}
  126 |         return origFetch(resource, init);
  127 |       };
  128 | 
  129 |       const origXOpen = XMLHttpRequest.prototype.open;
  130 |       XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
  131 |         // store the url for send()
  132 |         try { (this as any)._instrument_url = url?.toString?.() ?? String(url); } catch (e) {}
  133 |         return origXOpen.apply(this, arguments as any);
  134 |       };
  135 |       const origXSend = XMLHttpRequest.prototype.send;
  136 |       XMLHttpRequest.prototype.send = function (body?: Document | BodyInit | null) {
  137 |         try {
  138 |           const url = (this as any)._instrument_url ?? '';
  139 |           if (url.includes('/api/v1/settings') || url.includes('/api/v1/dashboard') || url.includes('/api/v1/search')) {
  140 |             const t = localStorage.getItem('cashflow.accessToken') || '';
  141 |             const masked = t ? `${t.slice(0, 8)}...len=${t.length}` : 'null';
  142 |             // eslint-disable-next-line no-console
  143 |             console.log('[req-sent-xhr]', JSON.stringify({ url, ts: Date.now(), token: masked }));
  144 |           }
  145 |         } catch (e) {}
  146 |         return origXSend.apply(this, arguments as any);
  147 |       };
  148 |     } catch (e) {}
  149 |   });
  150 | 
  151 |   await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' });
  152 |   await page.waitForSelector('#settings-currency', { timeout: 15000 });
  153 | 
  154 |   // Open the select and choose USD
  155 |   await page.click('#settings-currency');
  156 |   // Wait for popper content and click USD inside it
  157 |   const popper = page.locator('div[data-radix-popper-content-wrapper]');
  158 |   await expect(popper).toBeVisible({ timeout: 5000 });
  159 |   const option = popper.locator('text=USD').first();
  160 |   await expect(option).toBeVisible({ timeout: 5000 });
  161 |   // ensure the option is enabled before clicking
  162 |   await expect(option).toBeEnabled({ timeout: 5000 });
  163 |   // screenshot before clicking (diagnostic artifact)
  164 |   await page.screenshot({ path: 'currency-before.png', fullPage: false }).catch(() => null);
  165 | 
  166 |   // click and wait for responses collected via page.on('response')
  167 |   await option.click();
  168 |   // screenshot after clicking (diagnostic artifact)
  169 |   await page.screenshot({ path: 'currency-after.png', fullPage: false }).catch(() => null);
  170 |   // Wait up to 5s for client to update localStorage; poll because some code paths may overwrite quickly during hydration.
  171 |   const waited = await page.waitForFunction(() => {
  172 |     try { return localStorage.getItem('cashflow-dashboard-currency') === 'USD'; } catch { return false; }
  173 |   }, { timeout: 5000 }).catch(() => null);
  174 |   if (!waited) {
  175 |     console.log('[currency-sync] localStorage did not update within 5s (no reload fallback in this run)');
  176 |   }
  177 | 
  178 |   // dump diagnostics to console so Playwright includes them in run output
  179 |   console.log('[currency-sync] console logs:', JSON.stringify(consoleLogs.slice(-20)));
  180 |   console.log('[currency-sync] captured /settings responses:', JSON.stringify(settingsResponses));
  181 | 
  182 |   // If we captured a /settings response, assert it was ok (server persisted)
  183 |   if (settingsResponses.length > 0) {
  184 |     const ok = settingsResponses.some((r) => r.status >= 200 && r.status < 300);
  185 |     expect(ok, `expected at least one successful /settings response, got: ${JSON.stringify(settingsResponses)}`).toBeTruthy();
  186 |   } else {
  187 |     throw new Error('No /settings responses observed after selecting currency — check client-side persist behavior');
  188 |   }
  189 | 
  190 |   // read localStorage after server persist and log it for diagnostics
  191 |   const storedNow = await page.evaluate(() => localStorage.getItem('cashflow-dashboard-currency'));
  192 |   console.log('[currency-sync] localStorage after persist:', storedNow);
  193 | 
  194 |   // navigate to dashboard and check the currency selector displays USD (the app should reflect server state)
  195 |   await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  196 |   await page.waitForSelector('header');
  197 |   // allow a short settle for client store hydration
  198 |   await page.waitForTimeout(500);
  199 |   const hasUsd = await page.locator('header').innerText();
  200 |   console.log('[currency-sync] header text:', hasUsd);
> 201 |   expect(hasUsd.includes('USD')).toBeTruthy();
      |                                  ^ Error: expect(received).toBeTruthy()
  202 | });
```