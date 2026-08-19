# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright\phase9.spec.ts >> STEP 12G-1 PHASE 9: currency selector runtime verification
- Location: playwright\phase9.spec.ts:33:5

# Error details

```
ReferenceError: location is not defined
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
            - /url: /
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
            - /placeholder: Cari transaksi, akun, wawasan...
          - generic [ref=f2e118]:
            - generic [ref=f2e119]: Selasa, 18 Agustus 2026
            - status "Synced" [ref=f2e123]
            - button "Notifikasi" [ref=f2e127]
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
            - heading "Selamat datang kembali, Pengguna" [level=1] [ref=f2e141]
            - paragraph [ref=f2e142]: Berikut ringkasan keuangan Anda bulan ini.
          - generic [ref=f2e143]:
            - generic [ref=f2e144]:
              - generic [ref=f2e146]:
                - paragraph [ref=f2e147]: Saldo Saat Ini
                - paragraph [ref=f2e149]: Rp0
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
                - paragraph [ref=f2e188]: Rp0
              - generic [ref=f2e193]:
                - generic [ref=f2e194]: "-2,4%"
                - generic [ref=f2e198]: vs bulan lalu
            - generic [ref=f2e202]:
              - generic [ref=f2e204]:
                - paragraph [ref=f2e205]: Arus Kas
                - paragraph [ref=f2e207]: Rp0
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
              - paragraph [ref=f2e240]: Belum ada data.
            - generic [ref=f2e241]:
              - generic [ref=f2e242]: Kategori Pengeluaran
              - paragraph [ref=f2e251]: Belum ada data.
          - generic [ref=f2e252]:
            - generic [ref=f2e253]:
              - generic [ref=f2e254]:
                - generic [ref=f2e255]: Target Bulan Ini
                - button "Ciutkan" [expanded] [ref=f2e257]
              - generic [ref=f2e258]:
                - generic [ref=f2e259]:
                  - generic [ref=f2e260]:
                    - generic [ref=f2e261]: Dana Darurat
                    - generic [ref=f2e262]: 74%
                  - generic [ref=f2e265]:
                    - generic [ref=f2e266]:
                      - paragraph [ref=f2e267]: Target Bulan
                      - paragraph [ref=f2e268]: Rp 7.000.000
                    - generic [ref=f2e269]:
                      - paragraph [ref=f2e270]: Realisasi
                      - paragraph [ref=f2e271]: Rp 5.180.000
                    - generic [ref=f2e272]:
                      - paragraph [ref=f2e273]: Sisa
                      - paragraph [ref=f2e274]: Rp 1.820.000
                - generic [ref=f2e275]:
                  - generic [ref=f2e276]:
                    - generic [ref=f2e277]: Dana Liburan
                    - generic [ref=f2e278]: 46%
                  - generic [ref=f2e281]:
                    - generic [ref=f2e282]:
                      - paragraph [ref=f2e283]: Target Bulan
                      - paragraph [ref=f2e284]: Rp 5.000.000
                    - generic [ref=f2e285]:
                      - paragraph [ref=f2e286]: Realisasi
                      - paragraph [ref=f2e287]: Rp 2.300.000
                    - generic [ref=f2e288]:
                      - paragraph [ref=f2e289]: Sisa
                      - paragraph [ref=f2e290]: Rp 2.700.000
            - generic [ref=f2e291]:
              - link "Target Tabungan" [ref=f2e292] [cursor=pointer]:
                - /url: /goals
                - generic [ref=f2e293]:
                  - generic [ref=f2e294]:
                    - generic [ref=f2e295]: Target Tabungan
                    - paragraph [ref=f2e300]: Progres target tabungan aktif.
                  - generic [ref=f2e301]:
                    - paragraph [ref=f2e304]: 0%
                    - generic [ref=f2e305]:
                      - generic [ref=f2e306]:
                        - paragraph [ref=f2e307]: Target
                        - paragraph [ref=f2e308]: Rp0
                      - generic [ref=f2e309]:
                        - paragraph [ref=f2e310]: Terkumpul
                        - paragraph [ref=f2e311]: Rp0
                      - generic [ref=f2e312]:
                        - paragraph [ref=f2e313]: Sisa
                        - paragraph [ref=f2e314]: Rp0
                    - paragraph [ref=f2e315]: 0 selesai
              - generic [ref=f2e318]:
                - generic [ref=f2e319]:
                  - generic [ref=f2e320]: Ringkasan Investasi
                  - paragraph [ref=f2e321]: Total aset, profit, dan komposisi portofolio.
                - generic [ref=f2e322]:
                  - generic [ref=f2e323]:
                    - paragraph [ref=f2e324]: Nilai Saat Ini
                    - paragraph [ref=f2e325]: Rp0
                  - generic [ref=f2e326]:
                    - generic [ref=f2e327]:
                      - paragraph [ref=f2e328]: Total Profit
                      - paragraph [ref=f2e329]: Rp0
                    - generic [ref=f2e330]:
                      - paragraph [ref=f2e331]: Total Loss
                      - paragraph [ref=f2e332]: Rp0
                    - generic [ref=f2e333]:
                      - paragraph [ref=f2e334]: ROI
                      - paragraph [ref=f2e335]: 0.0%
                  - generic [ref=f2e336]:
                    - generic [ref=f2e337]: Alokasi per Jenis
                    - paragraph [ref=f2e340]: Belum ada data.
          - generic [ref=f2e341]:
            - generic [ref=f2e342]:
              - generic [ref=f2e343]:
                - generic [ref=f2e344]:
                  - generic [ref=f2e345]: Pemasukan vs Pengeluaran
                  - paragraph [ref=f2e346]: Tren bulanan
                - generic [ref=f2e347]: PemasukanPengeluaran
              - paragraph [ref=f2e357]: Belum ada data.
            - generic [ref=f2e358]:
              - generic [ref=f2e359]:
                - generic [ref=f2e360]: Kesehatan Keuangan
                - paragraph [ref=f2e361]: Indikator sederhana dari data transaksi Anda.
              - generic [ref=f2e362]:
                - generic [ref=f2e363]:
                  - generic [ref=f2e364]:
                    - paragraph [ref=f2e365]: Skor
                    - paragraph [ref=f2e366]: "20"
                  - generic [ref=f2e367]: Berisiko
                - generic [ref=f2e371]:
                  - generic [ref=f2e372]: Risk
                  - generic [ref=f2e373]: 20/100
                - generic [ref=f2e374]:
                  - generic [ref=f2e375]:
                    - term [ref=f2e376]: Saving Rate
                    - definition [ref=f2e377]: 0.0%
                  - generic [ref=f2e378]:
                    - term [ref=f2e379]: Rasio Pengeluaran
                    - definition [ref=f2e380]: 0.0%
                  - generic [ref=f2e381]:
                    - term [ref=f2e382]: Pemasukan vs Pengeluaran
                    - definition [ref=f2e383]: —
                  - generic [ref=f2e384]:
                    - term [ref=f2e385]: Konsentrasi Pengeluaran
                    - definition [ref=f2e386]: 0.0%
                  - generic [ref=f2e387]:
                    - term [ref=f2e388]: Arus Kas Bersih
                    - definition [ref=f2e389]: Rp0
          - generic [ref=f2e390]:
            - generic [ref=f2e392]:
              - generic [ref=f2e393]:
                - generic [ref=f2e394]: Transaksi Terbaru
                - paragraph [ref=f2e395]: Diperbarui baru saja
              - generic [ref=f2e396]:
                - textbox "Pencarian global" [ref=f2e398]:
                  - /placeholder: Cari transaksi...
                - button "Filter" [ref=f2e399]
            - generic [ref=f2e400]:
              - table [ref=f2e403]:
                - rowgroup [ref=f2e404]:
                  - row [ref=f2e405]:
                    - columnheader "Tanggal" [ref=f2e406]
                    - columnheader "Kategori" [ref=f2e407]
                    - columnheader "Deskripsi" [ref=f2e408]
                    - columnheader "Jumlah" [ref=f2e409]
                    - columnheader "Status" [ref=f2e410]
                    - columnheader "Aksi" [ref=f2e411]
                - rowgroup [ref=f2e412]:
                  - row [ref=f2e413]:
                    - cell "Jan 4, 2026 • 07:00" [ref=f2e414]
                    - cell "-" [ref=f2e415]
                    - cell [ref=f2e417]
                    - cell "-Rp 60.000" [ref=f2e418]
                    - cell "Berhasil" [ref=f2e419]
                    - cell [ref=f2e421]:
                      - button "Aksi" [ref=f2e422]
                  - row [ref=f2e423]:
                    - cell "Jan 3, 2026 • 07:00" [ref=f2e424]
                    - cell "-" [ref=f2e425]
                    - cell [ref=f2e427]
                    - cell "-Rp 50.000" [ref=f2e428]
                    - cell "Berhasil" [ref=f2e429]
                    - cell [ref=f2e431]:
                      - button "Aksi" [ref=f2e432]
                  - row [ref=f2e433]:
                    - cell "Jan 2, 2026 • 07:00" [ref=f2e434]
                    - cell "-" [ref=f2e435]
                    - cell [ref=f2e437]
                    - cell "+Rp 200.000" [ref=f2e438]
                    - cell "Berhasil" [ref=f2e439]
                    - cell [ref=f2e441]:
                      - button "Aksi" [ref=f2e442]
                  - row [ref=f2e443]:
                    - cell "Jan 1, 2026 • 07:00" [ref=f2e444]
                    - cell "-" [ref=f2e445]
                    - cell [ref=f2e447]
                    - cell "+Rp 100.000" [ref=f2e448]
                    - cell "Berhasil" [ref=f2e449]
                    - cell [ref=f2e451]:
                      - button "Aksi" [ref=f2e452]
              - generic [ref=f2e453]:
                - paragraph [ref=f2e454]: Menampilkan 1–4 dari 4
                - generic [ref=f2e455]:
                  - button "Sebelumnya" [disabled]
                  - generic [ref=f2e456]: Halaman 1 dari 1
                  - button "Berikutnya" [disabled]
          - generic [ref=f2e457]:
            - generic [ref=f2e458]:
              - generic [ref=f2e459]:
                - generic [ref=f2e460]: Aktivitas Terbaru
                - button "Ciutkan" [expanded] [ref=f2e462]
              - generic [ref=f2e463]:
                - list [ref=f2e464]:
                  - listitem [ref=f2e465]:
                    - generic [ref=f2e472]:
                      - paragraph [ref=f2e473]: Login
                      - paragraph [ref=f2e474]: Baru saja
                  - listitem [ref=f2e475]:
                    - generic [ref=f2e482]:
                      - paragraph [ref=f2e483]: Login
                      - paragraph [ref=f2e484]: 3 mnt lalu
                  - listitem [ref=f2e485]:
                    - generic [ref=f2e492]:
                      - paragraph [ref=f2e493]: Login
                      - paragraph [ref=f2e494]: 6 mnt lalu
                  - listitem [ref=f2e495]:
                    - generic [ref=f2e502]:
                      - paragraph [ref=f2e503]: Login
                      - paragraph [ref=f2e504]: 15 mnt lalu
                  - listitem [ref=f2e505]:
                    - generic [ref=f2e511]:
                      - paragraph [ref=f2e512]: Login
                      - paragraph [ref=f2e513]: 17 mnt lalu
                - link "Lihat semua aktivitas" [ref=f2e514] [cursor=pointer]:
                  - /url: /audit-log
            - generic [ref=f2e517]:
              - generic [ref=f2e519]:
                - generic [ref=f2e520]: Wawasan AI
                - paragraph [ref=f2e521]: Konteks IDR
              - generic [ref=f2e525]:
                - generic [ref=f2e526]: "Konteks IDR: dashboard Anda tetap selaras dengan preferensi tampilan aktif."
                - generic [ref=f2e527]: "Konteks IDR: kartu ringkasan mencerminkan konteks tampilan tanpa mengubah data akun."
  - status [ref=f2e528]:
    - generic [ref=f2e536]: Anda sedang offline.
    - generic [ref=f2e537]: Data mungkin tidak terbaru. Periksa koneksi internet Anda.
  - alert [ref=f2e538]
```

# Test source

```ts
  67  |         return origOpen.apply(this, arguments as any);
  68  |       };
  69  |       xhr.addEventListener('load', function () {
  70  |         try {
  71  |           if (typeof _url === 'string' && (_url.includes('/dashboard/widgets') || _url.includes('/dashboard/summary'))) {
  72  |             let body = null;
  73  |             try { body = JSON.parse(xhr.responseText); } catch (e) { body = null; }
  74  |             record({ transport: 'xhr', method: _method || 'GET', url: _url, status: xhr.status, body });
  75  |           }
  76  |         } catch (e) {}
  77  |       });
  78  |       return xhr;
  79  |     }
  80  |     (window as any).XMLHttpRequest = ProxyXHR as any;
  81  |   });
  82  | 
  83  |   // captured will be read from the page's __cf_network after actions
  84  |   const captured: Array<any> = []; // placeholder to hold extracted entries later
  85  | 
  86  |   // seed auth tokens + user from the verified E2E login (see beforeAll)
  87  |   await page.goto(base + '/');
  88  |   await page.evaluate((auth) => {
  89  |     try {
  90  |       if (auth) {
  91  |         localStorage.setItem('cashflow.accessToken', auth.accessToken);
  92  |         localStorage.setItem('cashflow.refreshToken', auth.refreshToken);
  93  |         localStorage.setItem('cashflow.user', JSON.stringify(auth.user));
  94  |       } else {
  95  |         console.warn('PHASE9 no verified auth fixture; proceeding unauthenticated');
  96  |       }
  97  |       sessionStorage.removeItem('cashflow-dashboard-currency');
  98  |     } catch (e) {
  99  |       // ignore
  100 |     }
  101 |   }, e2eAuth);
  102 | 
  103 |   // navigate to dashboard
  104 |   await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  105 | 
  106 |   // wait for header to render
  107 |   await page.waitForSelector('header');
  108 | 
  109 |   // ensure selector is present (the visible option text should be one of currency codes)
  110 |   const selectorText = await page.locator('header').locator('text=/IDR|USD|SGD|EUR/').first().textContent().catch(() => null);
  111 |   await expect(selectorText).not.toBeNull();
  112 | 
  113 | 
  114 |   // perform checks for each currency
  115 |   const currencies = ['IDR', 'USD', 'SGD', 'EUR'];
  116 |   const results: Record<string, { status?: number; url?: string; seen: boolean; uiText?: string } | { note: string }> = {};
  117 | 
  118 |   for (const c of currencies) {
  119 |     // Set sessionStorage to simulate selected currency and reload dashboard to ensure server requests use that currency
  120 |     await page.evaluate((cur) => {
  121 |       sessionStorage.setItem('cashflow-dashboard-currency', cur);
  122 |     }, c);
  123 | 
  124 |     // reset client-side captured array
  125 |     await page.evaluate(() => { try { (window as any).__cf_network = []; } catch (e) {} });
  126 | 
  127 |     await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  128 | 
  129 |     // wait a bit for dashboard network requests to fire
  130 |     await page.waitForTimeout(1200);
  131 | 
  132 |     // read captured network events from the page
  133 |     const entries = await page.evaluate(() => { return (window as any).__cf_network || []; });
  134 | 
  135 |     // attempt to find summary and widgets entries from captured events
  136 |     let summaryResponse = null;
  137 |     let widgetsResponse = null;
  138 |     try {
  139 |       summaryResponse = await page.waitForResponse((res) => res.url().includes('/dashboard/summary') && res.request().method() === 'GET', { timeout: 3000 });
  140 |     } catch (e) {
  141 |       summaryResponse = null;
  142 |     }
  143 |     try {
  144 |       widgetsResponse = await page.waitForResponse((res) => res.url().includes('/dashboard/widgets') && res.request().method() === 'GET', { timeout: 3000 });
  145 |     } catch (e) {
  146 |       widgetsResponse = null;
  147 |     }
  148 | 
  149 |     let summaryBody = null;
  150 |     let widgetsBody = null;
  151 |     try {
  152 |       if (summaryResponse) summaryBody = await summaryResponse.json();
  153 |     } catch (e) {
  154 |       summaryBody = null;
  155 |     }
  156 |     try {
  157 |       if (widgetsResponse) widgetsBody = await widgetsResponse.json();
  158 |     } catch (e) {
  159 |       widgetsBody = null;
  160 |     }
  161 | 
  162 |     // find relevant captured entries
  163 |     const summaryEntry = entries.find((e: any) => (e.url || '').includes('/dashboard/summary')) || null;
  164 |     const widgetsEntry = entries.find((e: any) => (e.url || '').includes('/dashboard/widgets')) || null;
  165 | 
  166 |     results[c] = {
> 167 |       summaryReq: summaryEntry ? { method: summaryEntry.method || summaryEntry.transport, url: summaryEntry.url, query: (new URL(summaryEntry.url, location.href).search || null) } : null,
      |                                                                                                                                                    ^ ReferenceError: location is not defined
  168 |       widgetsReq: widgetsEntry ? { method: widgetsEntry.method || widgetsEntry.transport, url: widgetsEntry.url, query: (new URL(widgetsEntry.url, location.href).search || null) } : null,
  169 |       summaryRes: summaryEntry ? { status: summaryEntry.status, body: summaryEntry.body } : null,
  170 |       widgetsRes: widgetsEntry ? { status: widgetsEntry.status, body: widgetsEntry.body } : null,
  171 |       uiText: await page.locator('header').locator(`text=${c}`).first().textContent().catch(() => null),
  172 |     } as any;
  173 | 
  174 |     await page.waitForTimeout(200);
  175 |   }
  176 | 
  177 |   // persistence check: set USD via sessionStorage then reload and inspect sessionStorage
  178 |   await page.evaluate(() => sessionStorage.setItem('cashflow-dashboard-currency', 'USD'));
  179 |   await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
  180 |   await page.waitForTimeout(400);
  181 |   const persisted = await page.evaluate(() => sessionStorage.getItem('cashflow-dashboard-currency'));
  182 | 
  183 |   // navigation check: go to /accounts and ensure QuickAdd presence (heuristic)
  184 |   await page.goto(base + '/accounts');
  185 |   const quickAddPresent = (await page.locator('text=Tambah Cepat').count()) > 0 || (await page.locator('header').locator('text=Tambah').count() > 0);
  186 | 
  187 |   // print results
  188 |   console.log('PHASE9 captured entries:', JSON.stringify(captured, null, 2));
  189 |   console.log('PHASE9 per-currency results:', JSON.stringify(results, null, 2));
  190 |   console.log('PHASE9 persisted sessionStorage:', persisted);
  191 |   console.log('PHASE9 quickAddPresent on non-dashboard page:', quickAddPresent);
  192 | 
  193 |   // Basic expectations
  194 |   expect(selectorText).not.toBeNull();
  195 |   expect(typeof persisted).toBe('string');
  196 | });
  197 | 
```