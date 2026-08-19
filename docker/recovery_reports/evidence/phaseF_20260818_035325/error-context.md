# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright\phase9.spec.ts >> STEP 12G-1 PHASE 9: currency selector runtime verification
- Location: playwright\phase9.spec.ts:33:5

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.waitForTimeout: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - generic [ref=f3e3]:
    - complementary [ref=f3e4]:
      - generic [ref=f3e10]:
        - paragraph [ref=f3e11]: CashFlow
        - paragraph [ref=f3e12]: Sistem keuangan pribadi
      - navigation "Buka menu navigasi" [ref=f3e16]:
        - generic [ref=f3e17]:
          - paragraph [ref=f3e18]: Utama
          - link "Beranda" [ref=f3e20] [cursor=pointer]:
            - /url: /
        - generic [ref=f3e25]:
          - button "Ciutkan Keuangan" [expanded] [ref=f3e26] [cursor=pointer]: Keuangan
          - generic [ref=f3e29]:
            - link "Akun" [ref=f3e30] [cursor=pointer]:
              - /url: /accounts
            - link "Pemasukan" [ref=f3e34] [cursor=pointer]:
              - /url: /incomes
            - link "Pengeluaran" [ref=f3e38] [cursor=pointer]:
              - /url: /expenses
            - link "Transaksi" [ref=f3e42] [cursor=pointer]:
              - /url: /transactions
            - link "Kategori" [ref=f3e46] [cursor=pointer]:
              - /url: /categories
        - generic [ref=f3e50]:
          - button "Ciutkan Perencanaan" [expanded] [ref=f3e51] [cursor=pointer]: Perencanaan
          - generic [ref=f3e54]:
            - link "Anggaran" [ref=f3e55] [cursor=pointer]:
              - /url: /budgets
            - link "Target Tabungan" [ref=f3e60] [cursor=pointer]:
              - /url: /goals
            - link "Investasi" [ref=f3e66] [cursor=pointer]:
              - /url: /investments
        - generic [ref=f3e71]:
          - button "Ciutkan Analisis & Insight" [expanded] [ref=f3e72] [cursor=pointer]: Analisis & Insight
          - generic [ref=f3e75]:
            - link "Perkiraan Keuangan" [ref=f3e76] [cursor=pointer]:
              - /url: /forecast
            - link "Laporan" [ref=f3e81] [cursor=pointer]:
              - /url: /reports
            - link "Analitik" [ref=f3e86] [cursor=pointer]:
              - /url: /analytics
        - generic [ref=f3e90]:
          - button "Ciutkan Sistem" [expanded] [ref=f3e91] [cursor=pointer]: Sistem
          - generic [ref=f3e94]:
            - link "Notifikasi" [ref=f3e95] [cursor=pointer]:
              - /url: /notifications
            - link "Audit Log" [ref=f3e100] [cursor=pointer]:
              - /url: /audit-log
            - link "Pengaturan" [ref=f3e105] [cursor=pointer]:
              - /url: /settings
      - button "Ciutkan Menu" [ref=f3e111]
    - generic [ref=f3e113]:
      - banner [ref=f3e114]:
        - generic [ref=f3e115]:
          - textbox "Pencarian global" [ref=f3e117]:
            - /placeholder: Cari transaksi, akun, wawasan...
          - generic [ref=f3e118]:
            - generic [ref=f3e119]: Selasa, 18 Agustus 2026
            - status "Synced" [ref=f3e123]
            - button "Notifikasi" [ref=f3e127]
            - button "Ganti ke mode terang" [ref=f3e128]
            - combobox [ref=f3e130]:
              - generic: IDR
            - button "U e2e.api.user@test.local" [ref=f3e131]:
              - generic [ref=f3e132]: U
              - generic [ref=f3e134]:
                - paragraph
                - paragraph [ref=f3e135]: e2e.api.user@test.local
      - main [ref=f3e136]:
        - generic [ref=f3e139]:
          - generic [ref=f3e140]:
            - heading "Selamat datang kembali, Pengguna" [level=1] [ref=f3e141]
            - paragraph [ref=f3e142]: Berikut ringkasan keuangan Anda bulan ini.
          - generic [ref=f3e143]:
            - generic [ref=f3e144]:
              - generic [ref=f3e146]:
                - paragraph [ref=f3e147]: Saldo Saat Ini
                - paragraph [ref=f3e149]: Rp0
              - generic [ref=f3e155]:
                - generic [ref=f3e156]: +4,2%
                - generic [ref=f3e160]: vs bulan lalu
            - generic [ref=f3e164]:
              - generic [ref=f3e166]:
                - paragraph [ref=f3e167]: Total Pemasukan
                - paragraph [ref=f3e169]: Rp0
              - generic [ref=f3e174]:
                - generic [ref=f3e175]: +8,1%
                - generic [ref=f3e179]: vs bulan lalu
            - generic [ref=f3e183]:
              - generic [ref=f3e185]:
                - paragraph [ref=f3e186]: Total Pengeluaran
                - paragraph [ref=f3e188]: Rp0
              - generic [ref=f3e193]:
                - generic [ref=f3e194]: "-2,4%"
                - generic [ref=f3e198]: vs bulan lalu
            - generic [ref=f3e202]:
              - generic [ref=f3e204]:
                - paragraph [ref=f3e205]: Arus Kas
                - paragraph [ref=f3e207]: Rp0
              - generic [ref=f3e216]:
                - generic [ref=f3e217]: +12,8%
                - generic [ref=f3e221]: vs bulan lalu
          - generic [ref=f3e225]:
            - generic [ref=f3e226]:
              - generic [ref=f3e227]:
                - generic [ref=f3e228]:
                  - generic [ref=f3e229]: Arus Kas Bulanan
                  - paragraph [ref=f3e230]: Tren bulanan
                - generic [ref=f3e231]: Saldo
              - paragraph [ref=f3e240]: Belum ada data.
            - generic [ref=f3e241]:
              - generic [ref=f3e242]: Kategori Pengeluaran
              - paragraph [ref=f3e251]: Belum ada data.
          - generic [ref=f3e252]:
            - generic [ref=f3e253]:
              - generic [ref=f3e254]:
                - generic [ref=f3e255]: Target Bulan Ini
                - button "Ciutkan" [expanded] [ref=f3e257]
              - generic [ref=f3e258]:
                - generic [ref=f3e259]:
                  - generic [ref=f3e260]:
                    - generic [ref=f3e261]: Dana Darurat
                    - generic [ref=f3e262]: 74%
                  - generic [ref=f3e265]:
                    - generic [ref=f3e266]:
                      - paragraph [ref=f3e267]: Target Bulan
                      - paragraph [ref=f3e268]: Rp 7.000.000
                    - generic [ref=f3e269]:
                      - paragraph [ref=f3e270]: Realisasi
                      - paragraph [ref=f3e271]: Rp 5.180.000
                    - generic [ref=f3e272]:
                      - paragraph [ref=f3e273]: Sisa
                      - paragraph [ref=f3e274]: Rp 1.820.000
                - generic [ref=f3e275]:
                  - generic [ref=f3e276]:
                    - generic [ref=f3e277]: Dana Liburan
                    - generic [ref=f3e278]: 46%
                  - generic [ref=f3e281]:
                    - generic [ref=f3e282]:
                      - paragraph [ref=f3e283]: Target Bulan
                      - paragraph [ref=f3e284]: Rp 5.000.000
                    - generic [ref=f3e285]:
                      - paragraph [ref=f3e286]: Realisasi
                      - paragraph [ref=f3e287]: Rp 2.300.000
                    - generic [ref=f3e288]:
                      - paragraph [ref=f3e289]: Sisa
                      - paragraph [ref=f3e290]: Rp 2.700.000
            - generic [ref=f3e291]:
              - link "Target Tabungan" [ref=f3e292] [cursor=pointer]:
                - /url: /goals
                - generic [ref=f3e293]:
                  - generic [ref=f3e294]:
                    - generic [ref=f3e295]: Target Tabungan
                    - paragraph [ref=f3e300]: Progres target tabungan aktif.
                  - generic [ref=f3e301]:
                    - paragraph [ref=f3e304]: 0%
                    - generic [ref=f3e305]:
                      - generic [ref=f3e306]:
                        - paragraph [ref=f3e307]: Target
                        - paragraph [ref=f3e308]: Rp0
                      - generic [ref=f3e309]:
                        - paragraph [ref=f3e310]: Terkumpul
                        - paragraph [ref=f3e311]: Rp0
                      - generic [ref=f3e312]:
                        - paragraph [ref=f3e313]: Sisa
                        - paragraph [ref=f3e314]: Rp0
                    - paragraph [ref=f3e315]: 0 selesai
              - generic [ref=f3e318]:
                - generic [ref=f3e319]:
                  - generic [ref=f3e320]: Ringkasan Investasi
                  - paragraph [ref=f3e321]: Total aset, profit, dan komposisi portofolio.
                - generic [ref=f3e322]:
                  - generic [ref=f3e323]:
                    - paragraph [ref=f3e324]: Nilai Saat Ini
                    - paragraph [ref=f3e325]: Rp0
                  - generic [ref=f3e326]:
                    - generic [ref=f3e327]:
                      - paragraph [ref=f3e328]: Total Profit
                      - paragraph [ref=f3e329]: Rp0
                    - generic [ref=f3e330]:
                      - paragraph [ref=f3e331]: Total Loss
                      - paragraph [ref=f3e332]: Rp0
                    - generic [ref=f3e333]:
                      - paragraph [ref=f3e334]: ROI
                      - paragraph [ref=f3e335]: 0.0%
                  - generic [ref=f3e336]:
                    - generic [ref=f3e337]: Alokasi per Jenis
                    - paragraph [ref=f3e340]: Belum ada data.
          - generic [ref=f3e341]:
            - generic [ref=f3e342]:
              - generic [ref=f3e343]:
                - generic [ref=f3e344]:
                  - generic [ref=f3e345]: Pemasukan vs Pengeluaran
                  - paragraph [ref=f3e346]: Tren bulanan
                - generic [ref=f3e347]: PemasukanPengeluaran
              - paragraph [ref=f3e357]: Belum ada data.
            - generic [ref=f3e358]:
              - generic [ref=f3e359]:
                - generic [ref=f3e360]: Kesehatan Keuangan
                - paragraph [ref=f3e361]: Indikator sederhana dari data transaksi Anda.
              - generic [ref=f3e362]:
                - generic [ref=f3e363]:
                  - generic [ref=f3e364]:
                    - paragraph [ref=f3e365]: Skor
                    - paragraph [ref=f3e366]: "20"
                  - generic [ref=f3e367]: Berisiko
                - generic [ref=f3e371]:
                  - generic [ref=f3e372]: Risk
                  - generic [ref=f3e373]: 20/100
                - generic [ref=f3e374]:
                  - generic [ref=f3e375]:
                    - term [ref=f3e376]: Saving Rate
                    - definition [ref=f3e377]: 0.0%
                  - generic [ref=f3e378]:
                    - term [ref=f3e379]: Rasio Pengeluaran
                    - definition [ref=f3e380]: 0.0%
                  - generic [ref=f3e381]:
                    - term [ref=f3e382]: Pemasukan vs Pengeluaran
                    - definition [ref=f3e383]: —
                  - generic [ref=f3e384]:
                    - term [ref=f3e385]: Konsentrasi Pengeluaran
                    - definition [ref=f3e386]: 0.0%
                  - generic [ref=f3e387]:
                    - term [ref=f3e388]: Arus Kas Bersih
                    - definition [ref=f3e389]: Rp0
          - generic [ref=f3e390]:
            - generic [ref=f3e392]:
              - generic [ref=f3e393]:
                - generic [ref=f3e394]: Transaksi Terbaru
                - paragraph [ref=f3e395]: Diperbarui baru saja
              - generic [ref=f3e396]:
                - textbox "Pencarian global" [ref=f3e398]:
                  - /placeholder: Cari transaksi...
                - button "Filter" [ref=f3e399]
            - generic [ref=f3e400]:
              - table [ref=f3e403]:
                - rowgroup [ref=f3e404]:
                  - row [ref=f3e405]:
                    - columnheader "Tanggal" [ref=f3e406]
                    - columnheader "Kategori" [ref=f3e407]
                    - columnheader "Deskripsi" [ref=f3e408]
                    - columnheader "Jumlah" [ref=f3e409]
                    - columnheader "Status" [ref=f3e410]
                    - columnheader "Aksi" [ref=f3e411]
                - rowgroup [ref=f3e412]:
                  - row [ref=f3e413]:
                    - cell "Jan 4, 2026 • 07:00" [ref=f3e414]
                    - cell "-" [ref=f3e415]
                    - cell [ref=f3e417]
                    - cell "-Rp 60.000" [ref=f3e418]
                    - cell "Berhasil" [ref=f3e419]
                    - cell [ref=f3e421]:
                      - button "Aksi" [ref=f3e422]
                  - row [ref=f3e423]:
                    - cell "Jan 3, 2026 • 07:00" [ref=f3e424]
                    - cell "-" [ref=f3e425]
                    - cell [ref=f3e427]
                    - cell "-Rp 50.000" [ref=f3e428]
                    - cell "Berhasil" [ref=f3e429]
                    - cell [ref=f3e431]:
                      - button "Aksi" [ref=f3e432]
                  - row [ref=f3e433]:
                    - cell "Jan 2, 2026 • 07:00" [ref=f3e434]
                    - cell "-" [ref=f3e435]
                    - cell [ref=f3e437]
                    - cell "+Rp 200.000" [ref=f3e438]
                    - cell "Berhasil" [ref=f3e439]
                    - cell [ref=f3e441]:
                      - button "Aksi" [ref=f3e442]
                  - row [ref=f3e443]:
                    - cell "Jan 1, 2026 • 07:00" [ref=f3e444]
                    - cell "-" [ref=f3e445]
                    - cell [ref=f3e447]
                    - cell "+Rp 100.000" [ref=f3e448]
                    - cell "Berhasil" [ref=f3e449]
                    - cell [ref=f3e451]:
                      - button "Aksi" [ref=f3e452]
              - generic [ref=f3e453]:
                - paragraph [ref=f3e454]: Menampilkan 1–4 dari 4
                - generic [ref=f3e455]:
                  - button "Sebelumnya" [disabled]
                  - generic [ref=f3e456]: Halaman 1 dari 1
                  - button "Berikutnya" [disabled]
          - generic [ref=f3e457]:
            - generic [ref=f3e458]:
              - generic [ref=f3e459]:
                - generic [ref=f3e460]: Aktivitas Terbaru
                - button "Ciutkan" [expanded] [ref=f3e462]
              - generic [ref=f3e463]:
                - list [ref=f3e464]:
                  - listitem [ref=f3e465]:
                    - generic [ref=f3e472]:
                      - paragraph [ref=f3e473]: Login
                      - paragraph [ref=f3e474]: Baru saja
                  - listitem [ref=f3e475]:
                    - generic [ref=f3e482]:
                      - paragraph [ref=f3e483]: Login
                      - paragraph [ref=f3e484]: 3 mnt lalu
                  - listitem [ref=f3e485]:
                    - generic [ref=f3e492]:
                      - paragraph [ref=f3e493]: Login
                      - paragraph [ref=f3e494]: 6 mnt lalu
                  - listitem [ref=f3e495]:
                    - generic [ref=f3e502]:
                      - paragraph [ref=f3e503]: Login
                      - paragraph [ref=f3e504]: 9 mnt lalu
                  - listitem [ref=f3e505]:
                    - generic [ref=f3e512]:
                      - paragraph [ref=f3e513]: Login
                      - paragraph [ref=f3e514]: 18 mnt lalu
                  - listitem [ref=f3e515]:
                    - generic [ref=f3e521]:
                      - paragraph [ref=f3e522]: Login
                      - paragraph [ref=f3e523]: 20 mnt lalu
                - link "Lihat semua aktivitas" [ref=f3e524] [cursor=pointer]:
                  - /url: /audit-log
            - generic [ref=f3e527]:
              - generic [ref=f3e529]:
                - generic [ref=f3e530]: Wawasan AI
                - paragraph [ref=f3e531]: Konteks IDR
              - generic [ref=f3e535]:
                - generic [ref=f3e536]: "Konteks IDR: dashboard Anda tetap selaras dengan preferensi tampilan aktif."
                - generic [ref=f3e537]: "Konteks IDR: kartu ringkasan mencerminkan konteks tampilan tanpa mengubah data akun."
  - status [ref=f3e538]:
    - generic [ref=f3e546]: Anda sedang offline.
    - generic [ref=f3e547]: Data mungkin tidak terbaru. Periksa koneksi internet Anda.
  - alert [ref=f3e548]
```

# Test source

```ts
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
  167 |       summaryReq: summaryEntry ? { method: summaryEntry.method || summaryEntry.transport, url: summaryEntry.url, query: (new URL(summaryEntry.url, base).search || null) } : null,
  168 |       widgetsReq: widgetsEntry ? { method: widgetsEntry.method || widgetsEntry.transport, url: widgetsEntry.url, query: (new URL(widgetsEntry.url, base).search || null) } : null,
  169 |       summaryRes: summaryEntry ? { status: summaryEntry.status, body: summaryEntry.body } : null,
  170 |       widgetsRes: widgetsEntry ? { status: widgetsEntry.status, body: widgetsEntry.body } : null,
  171 |       uiText: await page.locator('header').locator(`text=${c}`).first().textContent().catch(() => null),
  172 |     } as any;
  173 | 
> 174 |     await page.waitForTimeout(200);
      |                ^ Error: page.waitForTimeout: Target page, context or browser has been closed
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