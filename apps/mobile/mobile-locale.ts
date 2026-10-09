import { enText } from "../frontend/src/locales/en";
import { idText } from "../frontend/src/locales/id";

export type MobileLanguage = "id" | "en";

const translations = new Map<string, string>();

function collectTranslations(indonesian: unknown, english: unknown) {
  if (typeof indonesian === "string" && typeof english === "string") {
    if (!translations.has(indonesian)) translations.set(indonesian, english);
    return;
  }

  if (
    !indonesian ||
    !english ||
    typeof indonesian !== "object" ||
    typeof english !== "object"
  ) {
    return;
  }

  const englishEntries = english as Record<string, unknown>;
  for (const [key, value] of Object.entries(indonesian)) {
    collectTranslations(value, englishEntries[key]);
  }
}

collectTranslations(idText, enText);

for (const [indonesian, english] of [
  ["Transaksi belum lengkap", "Transaction is incomplete"],
  ["Transaksi Berhasil", "Transaction successful."],
  ["Transaksi berhasil diperbarui.", "Transaction updated."],
  ["Transaksi tersinkron.", "Transactions synced."],
  ["Transaksi sudah menunggu penghapusan.", "This transaction is already queued for deletion."],
  ["Belum tersinkron", "Not synced yet"],
  ["Sinkronisasi gagal", "Sync failed"],
  ["Coba sinkronkan lagi", "Try syncing again"],
  ["Perubahan transaksi menunggu koneksi.", "Transaction changes are waiting for a connection."],
  ["Online", "Online"],
  ["Offline", "Offline"],
  ["Menyinkronkan transaksi...", "Syncing transactions..."],
  ["Synced", "Synced"],
  ["Tidak ada koneksi jaringan.", "No network connection."],
  ["Aktifkan Wi-Fi atau data seluler untuk menyambung kembali.", "Turn on Wi-Fi or mobile data to reconnect."],
  ["transaksi menunggu sinkronisasi.", "transaction(s) waiting to sync."],
  ["Hapus dari antrean", "Dismiss failed items"],
  ["Hapus perubahan gagal dari antrean lokal? Perubahan tersebut tidak akan dikirim ke server.", "Remove failed changes from the local queue? Those changes will not be sent to the server."],
  ["Laporan berhasil diunduh.", "Report downloaded."],
  ["Login tidak dapat diselesaikan. Silakan coba lagi.", "Login could not be completed. Please try again."],
  ["Logout dari akun Anda?", "Log out of your account?"],
  ["Apakah Anda yakin ingin keluar dari akun ini?", "Are you sure you want to log out of this account?"],
  ["Batal", "Cancel"],
  ["Logout", "Log out"],
  ["Memuat laporan...", "Loading report..."],
  ["Menyimpan...", "Saving..."],
  ["Kategori berhasil disimpan.", "Category saved."],
  ["Kategori berhasil diperbarui.", "Category updated."],
  ["Kategori berhasil dihapus.", "Category deleted."],
  ["SALDO SAAT INI", "CURRENT BALANCE"],
  ["ARUS KAS", "CASH FLOW"],
  ["PEMASUKAN", "INCOME"],
  ["PENGELUARAN", "EXPENSE"],
  ["Total pemasukan dikurangi pengeluaran", "Total income minus expenses"],
  ["dibanding bulan lalu", "compared with last month"],
  ["Belum ada data pembanding", "No comparison data yet"],
  ["Periode bulan ini", "This month"],
  ["Isi kategori dan nominal lebih dari nol sebelum menyimpan.", "Enter a category and an amount greater than zero before saving."],
  ["Tanggal tidak valid", "Invalid date"],
  ["Pilih tanggal transaksi dari kalender.", "Choose a transaction date from the calendar."],
  ["Tanggal transaksi", "Transaction date"],
  ["Wajib diisi", "Required"],
  ["Nominal harus berupa angka", "Amount must be a number"],
  ["Perubahan tersimpan di sesi aplikasi ini.", "Changes are saved for this app session."],
  ["Memuat notifikasi...", "Loading notifications..."],
  ["Gagal memuat notifikasi.", "Failed to load notifications."],
  ["Tidak ada menu yang cocok", "No matching menu found"],
  ["Belum ada notifikasi.", "No notifications yet."],
  ["Tandai semua dibaca", "Mark all as read"],
  ["Lihat Semua", "View all"],
  ["Buka menu navigasi", "Open navigation menu"],
  ["Pencarian menu", "Search menus"],
  ["Notifikasi", "Notifications"],
  ["Waktu pengingat mengikuti zona waktu akun", "Reminder times use your account time zone"],
  ["Sesi akun tidak dapat dimuat", "Account session could not be loaded"],
  ["Tidak ada pilihan", "No options available"],
  ["Risiko", "Risk"],
  ["Menampilkan", "Showing"],
  ["dari", "of"],
  ["Estimasi tercapai:", "Estimated completion:"],
  ["· Keluar", "· Expenses"],
  ["Daftar tersimpan lokal. Sinkronisasi server belum selesai.", "List saved locally. Server synchronization is still pending."],
  ["Data akun dari backend", "Account data from the backend"],
  ["Bersumber dari analisis backend akun Anda.", "Based on your account's backend analysis."],
  ["Tidak ada anggaran yang cocok", "No matching budgets"],
  ["Ubah kata pencarian untuk melihat anggaran.", "Change your search to see other budgets."],
  ["Tambahkan anggaran untuk mulai menetapkan batas pengeluaran.", "Add a budget to set a spending limit."],
  ["Tambah Anggaran", "Add budget"],
  ["Total Anggaran", "Total budget"],
  ["Total Terpakai", "Total spent"],
  ["Melebihi batas", "Over budget"],
  ["Baris per halaman", "Rows per page"],
  ["Sebelumnya", "Previous"],
  ["Berikutnya", "Next"],
  ["Detail Anggaran", "Budget details"],
  ["Nominal Anggaran", "Budget amount"],
  ["Masukkan jumlah", "Enter an amount"],
  ["Rentang tanggal tidak valid", "Invalid date range"],
  ["Pilih tanggal yang tersedia dan pastikan tanggal mulai tidak melewati tanggal akhir.", "Choose valid dates and make sure the start date is not after the end date."],
  ["Rentang tidak valid", "Invalid date range"],
  ["Pastikan tanggal tersedia dan tanggal mulai tidak melewati tanggal akhir.", "Choose valid dates and make sure the start date is not after the end date."],
  ["Kategori tidak ditemukan.", "No categories found."],
  ["Ubah pencarian atau filter untuk melihat kategori lain.", "Change your search or filters to see other categories."],
  ["Semua jenis", "All types"],
  ["Reset Filter", "Reset filters"],
  ["Sistem", "System"],
  ["Aktif", "Active"],
  ["Pilih tanggal", "Select a date"],
  ["Belum cukup data", "Not enough data"],
  ["Selesai", "Completed"],
  ["Dibatalkan", "Cancelled"],
  ["Terkumpul", "Saved"],
  ["Sisa", "Remaining"],
  ["Jangka waktu perkiraan", "Forecast horizon"],
  ["Prediksi pengeluaran", "Spending forecast"],
  ["Pratinjau pengeluaran Anda berdasarkan kategori.", "A category breakdown of your forecast spending."],
  ["Dihitung dari transaksi demo lokal.", "Based on local demo transactions."],
  ["Belum cukup data untuk membuat perkiraan keuangan.", "Not enough data to create a financial forecast."],
  ["Tambah riwayat transaksi untuk membuka perkiraan yang lebih lengkap.", "Add transaction history to see a more complete forecast."],
  ["Belum ada transaksi pada periode ini.", "No transactions in this period."],
  ["Tren pemasukan dan pengeluaran belum tersedia.", "Income and expense trends are not available yet."],
  ["Belum ada data pemasukan atau pengeluaran pada periode ini.", "No income or expenses in this period."],
  ["Belum ada transaksi untuk kategori ini pada periode terpilih.", "No transactions for this category in the selected period."],
  ["Rentang ini belum mencakup satu bulan kalender penuh. Pilih rentang yang mencakup satu bulan penuh untuk membandingkan anggaran dan pengeluaran.", "This range does not include a full calendar month. Choose a range that includes one full month to compare budgets and expenses."],
  ["Belum ada anggaran atau pengeluaran pada bulan penuh yang dipilih.", "No budgets or expenses in the selected full month."],
  ["Pilih Periode", "Select a period"],
  ["Tanggal mulai", "Start date"],
  ["Tanggal akhir", "End date"],
  ["Terapkan Periode", "Apply period"],
  ["Bulan Ini", "This month"],
  ["Bulan Lalu", "Last month"],
  ["3 Bulan Terakhir", "Last 3 months"],
  ["6 Bulan Terakhir", "Last 6 months"],
  ["Tahun Ini", "This year"],
  ["Kustom", "Custom"],
  ["Konsentrasi Pengeluaran", "Expense concentration"],
  ["Arus Kas", "Cash flow"],
  ["Arus Kas Bersih", "Net cash flow"],
  ["Belum cukup data untuk menilai kesehatan keuangan.", "Not enough data to assess financial health."],
  ["Wawasan", "Insights"],
  ["Wawasan dari data keuangan Anda.", "Insights from your financial data."],
  ["Belum ada wawasan untuk periode ini.", "No insights for this period."],
  ["Analitik Keuangan", "Financial analytics"],
  ["Wawasan mendalam atas performa keuangan Anda.", "Detailed insights into your financial performance."],
  ["Perkiraan Keuangan", "Financial forecast"],
  ["Gambaran ke depan untuk pemasukan, pengeluaran, dan saldo yang diproyeksikan.", "A projection of future income, expenses, and balance."],
  ["Tutup rincian grafik", "Close chart details"],
  ["Transaksi terkait", "Related transactions"],
  ["Tidak ada transaksi untuk pilihan ini.", "No transactions for this selection."],
  ["Ketuk grafik untuk melihat rincian dan transaksi.", "Tap the chart to see details and transactions."],
  ["Ringkasan transaksi pada periode grafik ini.", "Transaction summary for this chart period."],
  ["Rincian komposisi pengeluaran pada periode ini.", "Expense breakdown for this period."],
  ["Persentase dari total", "Percentage of total"],
  ["Sisa Anggaran", "Remaining budget"],
  ["Total Pengeluaran", "Total expenses"],
  ["Ketuk untuk melihat transaksi", "Tap to view transactions"],
  ["Laporan Keuangan", "Financial reports"],
  ["Ringkasan kinerja keuangan Anda dalam periode terpilih.", "A summary of your financial performance for the selected period."],
  ["Nama kategori wajib diisi", "Category name is required"],
  ["Kategori anggaran", "Budget category"],
  ["KONTEKS IDR", "IDR CONTEXT"],
  ["Pemasukan tercatat pada periode ini setelah sebelumnya kosong.", "Income was recorded in this period after none in the previous period."],
  ["Clear", "Clear"],
  ["Today", "Today"],
  ["Pilih Ikon", "Choose an icon"],
  ["Pilih Warna", "Choose a color"],
  ["Deskripsi (Opsional)", "Description (optional)"],
  ["Deskripsi (opsional)", "Description (optional)"],
  ["Belum ada komposisi aset untuk ditampilkan.", "No asset allocation to display."],
  ["Total", "Total"],
  ["Data analitik dihitung dari transaksi demo lokal.", "Analytics are based on local demo transactions."],
  ["Data demo lokal", "Local demo data"],
  ["Skor kesehatan keuangan", "Financial health score"],
  ["Kepercayaan:", "Confidence:"],
  ["bulan riwayat", "months of history"],
  ["Neraca", "Balance sheet"],
  ["Admin ganteng", "Admin"],
  ["Kelola profil dan sesi pada akun Anda.", "Manage your profile and sessions on your account."],
  ["Data profil akun belum tersedia di aplikasi native.", "Account profile data is not available in the native app yet."],
  ["Gaya bicara bot", "Bot response style"],
  ["Waktu pengingat mengikuti zona waktu perangkat.", "Reminder times follow your device's time zone."],
  ["Notifikasi perangkat belum tersedia di aplikasi native.", "Device notifications are not available in the native app yet."],
  ["Informasi versi aplikasi.", "App version information."],
  ["Dihitung dari transaksi demo lokal.", "Based on local demo transactions."],
  ["Data analitik dihitung dari transaksi demo lokal.", "Analytics are based on local demo transactions."],
  ["Data demo lokal", "Local demo data"],
  ["Skor kesehatan keuangan", "Financial health score"],
  ["Belum cukup data untuk menilai kesehatan keuangan.", "Not enough data to assess financial health."],
  ["Batas pengeluaran untuk kategori dan periode.", "Spending limit for a category and period."],
  ["Bulan", "Month"],
  ["Bulan anggaran", "Budget month"],
  ["Atur pengingat dan gaya Finance Bot.", "Configure Finance Bot reminders and style."],
  ["Atur pengingat dan notifikasi penting.", "Configure reminders and important notifications."],
  ["Pemberitahuan dan aktivitas akun Anda.", "Your account notifications and activity."],
  ["Terjadi kesalahan yang tidak terduga.", "An unexpected error occurred."],
  ["Coba lagi", "Try again"],
  ["Belum ada data.", "No data yet."],
  ["Akun", "Account"],
  ["Profil", "Profile"],
  ["Sesi Aktif", "Active sessions"],
  ["Perangkat yang sedang login dengan akun Anda", "Devices currently signed in to your account"],
  ["Tentang", "About"],
  ["Versi", "Version"],
  ["target", "goals"],
  ["Tambah Target", "Add goal"],
  ["Cari target tabungan...", "Search savings goals..."],
  ["Cari deskripsi, kategori, akun, jumlah, atau status...", "Search description, category, account, amount, or status..."],
  ["Wawasan AI", "AI insights"],
  ["Lainnya", "Other"],
  ["Saham", "Stocks"],
  ["Reksa Dana", "Mutual funds"],
  ["Emas", "Gold"],
  ["Kripto", "Crypto"],
  ["Obligasi", "Bonds"],
  ["Deposito", "Deposit"],
  ["Properti", "Property"],
  ["Dijual", "Sold"],
  ["Ditutup", "Closed"],
  ["Total Modal", "Total invested"],
  ["Nilai Saat Ini", "Current value"],
  ["Tanggal Beli", "Purchase date"],
  ["Komposisi Aset", "Asset allocation"],
  ["Cari investasi...", "Search investments..."],
  ["Tambah Investasi", "Add investment"],
  ["Anggaran vs Pengeluaran per Kategori", "Budget vs expenses by category"],
  ["Membandingkan bulan kalender penuh yang tercakup dalam periode terpilih.", "Comparing full calendar months within the selected period."],
  ["Komposisi Pengeluaran per Kategori", "Expense composition by category"],
  ["Proporsi total pengeluaran untuk periode terpilih.", "Share of total expenses for the selected period."],
  ["Proyeksi arus kas", "Cash flow projection"],
  ["Bersumber dari analisis backend akun Anda.", "Based on your account's backend analysis."],
  ["Data akun dari backend", "Account data from the backend"],
  ["Periode", "Period"],
  ["Pemasukan vs Pengeluaran", "Income vs expenses"],
  ["Perbandingan per periode.", "Comparison by period."],
  ["Kategori Terbesar", "Top categories"],
  ["Kategori Pengeluaran Terbesar", "Top expense categories"],
  ["Kategori Pemasukan Terbesar", "Top income categories"],
  ["Belum ada pengeluaran pada periode ini.", "No expenses in this period."],
  ["Belum ada pemasukan pada periode terpilih.", "No income in the selected period."],
  ["SAVING RATE", "SAVINGS RATE"],
  ["Pilih periode. Saat ini ", "Select a period. Currently "],
  ["Pilih jangka waktu perkiraan. Saat ini ", "Select the forecast horizon. Currently "],
  ["Tutup menu", "Close menu"],
  ["Nama Kategori", "Category name"],
  ["Jenis kategori", "Category type"],
  ["Warna ", "Color "],
  ["Cari kategori...", "Search categories..."],
  ["Pencarian kategori", "Search categories"],
  ["Tidak ada data.", "No data."],
  ["Cari transaksi...", "Search transactions..."],
  ["Pencarian transaksi", "Search transactions"],
  ["Filter status target", "Filter goal status"],
  ["Urutkan target", "Sort goals"],
  ["Cari target tabungan...", "Search savings goals..."],
  ["Cari menu...", "Search menus..."],
  ["Cari menu", "Search menus"],
  ["Tutup pencarian menu", "Close menu search"],
  ["Hasil menu", "Menu results"],
  ["Bulan sebelumnya", "Previous month"],
  ["Bulan berikutnya", "Next month"],
  ["Masukkan nama kategori", "Enter a category name"],
  ["Masukkan deskripsi kategori", "Enter a category description"],
  ["Nama target tabungan", "Savings goal name"],
  ["Catatan tentang target ini", "Notes about this goal"],
  ["Deskripsi target", "Goal description"],
  ["Nominal target", "Goal amount"],
  ["Nominal terkumpul", "Amount saved"],
  ["Tanggal target", "Target date"],
  ["Jenis investasi", "Investment type"],
  ["Status investasi", "Investment status"],
  ["Nama investasi", "Investment name"],
  ["Platform investasi", "Investment platform"],
  ["Simbol (opsional)", "Symbol (optional)"],
  ["Catatan (opsional)", "Notes (optional)"],
  ["Belum ada data pengeluaran pada periode ini.", "No expense data in this period."],
  ["Belum cukup data untuk menampilkan tren arus kas.", "Not enough data to display the cash flow trend."],
  ["Belum ada transaksi pada periode terpilih.", "No transactions in the selected period."],
  ["Belum ada pengeluaran pada periode terpilih.", "No expenses in the selected period."],
  ["Belum ada pemasukan pada periode ini.", "No income in this period."],
  ["Tutup pemilih periode", "Close period selector"],
  ["Tutup pemilih jangka waktu", "Close forecast horizon selector"],
  ["Log Aktivitas", "Activity log"],
  ["Sesi aktif pada setiap perangkat.", "Active sessions on each device."],
  ["Belum ada sesi perangkat.", "No active device sessions."],
  ["Gaya bicara khusus", "Custom response style"],
  ["Tulis gaya bicara bot", "Describe the bot's response style"],
  ["Belum ada sesi perangkat.", "No device sessions yet."],
  ["Memuat sesi aktif...", "Loading active sessions..."],
  ["Sesi aktif tidak dapat dimuat.", "Active sessions could not be loaded."],
  ["Perangkat tidak diketahui", "Unknown device"],
  ["Perangkat seluler", "Mobile device"],
  ["Komputer", "Computer"],
  ["Browser web", "Web browser"],
  ["Lokasi tidak diketahui", "Unknown location"],
  ["Perangkat ini", "This device"],
  ["Sesi aktif pada perangkat", "Active device sessions"],
  ["Keluarkan perangkat?", "Sign this device out?"],
  ["Sesi pada", "The session on"],
  ["akan dikeluarkan dari akun.", "will be signed out of your account."],
  ["Keluarkan", "Sign out"],
  ["Perangkat tidak dapat dikeluarkan.", "The device could not be signed out."],
  ["Keluar dari perangkat lain?", "Sign out other devices?"],
  ["Sesi di perangkat lain akan dikeluarkan. Perangkat ini tetap masuk.", "Other device sessions will be signed out. This device will stay signed in."],
  ["Keluar dari perangkat lain", "Sign out other devices"],
  ["Batalkan", "Cancel"],
  ["Mengerti", "Got it"],
  ["Notifikasi belum aktif", "Notifications are off"],
  ["Server belum dapat mendaftarkan notifikasi.", "The server could not register notifications."],
  ["Coba lagi.", "Try again."],
  ["Zona berbahaya", "Danger zone"],
  ["Penghapusan akun akan menghapus akun dan data terkait secara permanen.", "Deleting your account permanently removes the account and its related data."],
  ["Hapus akun", "Delete account"],
  ["Tindakan ini tidak dapat dibatalkan. Masukkan email akun untuk melanjutkan.", "This action cannot be undone. Enter your account email to continue."],
  ["Konfirmasi email", "Confirm email"],
  ["Akun ini tidak menggunakan kata sandi manual. Konfirmasi email saja sudah cukup.", "This account has no manual password. Email confirmation is enough."],
  ["Kata sandi saat ini", "Current password"],
  ["Email konfirmasi tidak cocok dengan akun.", "The confirmation email does not match this account."],
  ["Masukkan kata sandi saat ini untuk menghapus akun.", "Enter your current password to delete the account."],
  ["Server tidak mengonfirmasi penghapusan akun.", "The server did not confirm account deletion."],
  ["Akun tidak dapat dihapus. Coba lagi.", "The account could not be deleted. Try again."],
  ["Akun sudah dihapus.", "Account deleted."],
  ["Data sesi di perangkat tidak dapat dibersihkan. Tutup dan buka kembali aplikasi.", "Local session data could not be cleared. Close and reopen the app."],
  ["Data anggaran belum lengkap", "Budget details are incomplete"],
  ["Pilih kategori dan masukkan jumlah anggaran lebih dari nol.", "Choose a category and enter a budget amount greater than zero."],
  ["Anggaran sudah ada", "Budget already exists"],
  ["Kategori tersebut sudah memiliki anggaran untuk periode ini.", "This category already has a budget for this period."],
  ["Periksa data target", "Check the goal details"],
  ["Isi nama, nominal target yang lebih dari nol, nominal terkumpul, dan tanggal yang valid.", "Enter a name, a target greater than zero, the amount saved, and valid dates."],
  ["Periksa data investasi", "Check the investment details"],
  ["Isi nama, platform, jumlah unit, harga, modal, dan tanggal beli yang valid.", "Enter a name, platform, quantity, price, invested amount, and a valid purchase date."],
  ["SALDO SAAT INI", "CURRENT BALANCE"],
  ["TOTAL PEMASUKAN", "TOTAL INCOME"],
  ["ARUS KAS", "CASH FLOW"],
  ["TOTAL PENGELUARAN", "TOTAL EXPENSES"],
  ["Saldo awal dan arus kas tercatat", "Initial balance and recorded cash flow"],
  ["Berdasarkan transaksi tercatat", "Based on recorded transactions"],
  ["Pemasukan dikurangi pengeluaran", "Income minus expenses"],
  ["Filter transaksi", "Transaction filters"],
  ["Tren Saving Rate", "Savings rate trend"],
  ["Persentase pemasukan yang tersisa setelah pengeluaran.", "Percentage of income remaining after expenses."],
  ["Belum ada transaksi pada periode ini, jadi saving rate belum dapat dihitung.", "There are no transactions in this period, so the savings rate cannot be calculated."],
  ["Belum ada pemasukan pada periode ini. Saving rate dihitung saat ada pemasukan.", "There is no income in this period. The savings rate is calculated only for periods with income."],
  ["Rincian pemasukan dan pengeluaran pada periode ini.", "Income and expense details for this period."],
  ["Tidak tersedia", "Not available"],
  ["Baru", "New"],
  ["vs periode sebelumnya", "vs previous period"],
] as const) {
  translations.set(indonesian, english);
}

export function translateMobileText(value: string, language: MobileLanguage): string {
  if (language === "id") return value;

  const trimmedValue = value.trim();
  if (trimmedValue.length !== value.length) {
    if (!trimmedValue) return value;
    const leadingWhitespace = value.slice(0, value.length - value.trimStart().length);
    const trailingWhitespace = value.slice(value.trimEnd().length);
    return `${leadingWhitespace}${translateMobileText(trimmedValue, language)}${trailingWhitespace}`;
  }

  const exactTranslation = translations.get(value);
  if (exactTranslation) return exactTranslation;

  const budgetPeriod = value.match(/^Belum ada anggaran untuk (.+)$/);
  if (budgetPeriod) return `No budgets for ${translateMobileText(budgetPeriod[1], language)}`;

  const goalEstimate = value.match(/^Estimasi tercapai: (.+)$/);
  if (goalEstimate) return `Estimated completion: ${translateMobileText(goalEstimate[1], language)}`;

  const forecastPeriod = value.match(/^Periode prediksi: (.+)$/);
  if (forecastPeriod) return `Forecast period: ${translateMobileText(forecastPeriod[1], language)}`;

  const analyticsChange = value.match(/^(Pemasukan|Pengeluaran) (naik|turun) (.+)% dibanding periode sebelumnya\.$/);
  if (analyticsChange) {
    const subject = analyticsChange[1] === "Pemasukan" ? "Income" : "Expenses";
    const direction = analyticsChange[2] === "naik" ? "increased" : "decreased";
    return `${subject} ${direction} by ${analyticsChange[3]}% compared with the previous period.`;
  }

  const savingsChange = value.match(/^Saving rate (naik|turun) (\d+) poin persentase\.$/);
  if (savingsChange) {
    const direction = savingsChange[1] === "naik" ? "increased" : "decreased";
    return `Savings rate ${direction} by ${savingsChange[2]} percentage points.`;
  }

  const cashflowBreakdown = value.match(/^Masuk (.+) · Keluar (.+)$/);
  if (cashflowBreakdown) {
    return `Income ${translateMobileText(cashflowBreakdown[1], language)} · Expenses ${translateMobileText(cashflowBreakdown[2], language)}`;
  }

  const categoryInsight = value.match(/^Kategori (.+) merupakan pengeluaran terbesar \(([\d.,]+%) dari total pengeluaran\)\.$/);
  if (categoryInsight) return `Category ${categoryInsight[1]} is the largest expense (${categoryInsight[2]} of total expenses).`;

  const cashFlowInsight = value.match(/^Arus kas bersih (positif|negatif) sebesar (.+)\.$/);
  if (cashFlowInsight) {
    const direction = cashFlowInsight[1] === "positif" ? "positive" : "negative";
    return `Net cash flow is ${direction} at ${translateMobileText(cashFlowInsight[2], language)}.`;
  }

  const budgetAmount = value.match(/^(Anggaran|Terpakai) (Rp ?.+)$/);
  if (budgetAmount) {
    const label = budgetAmount[1] === "Anggaran" ? "Budget" : "Spent";
    return `${label} ${translateMobileText(budgetAmount[2], language)}`;
  }

  const currencyAmount = value.match(/^([+-]?Rp ?)(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?$/);
  if (currencyAmount) {
    const [, prefix, whole, fraction = ""] = currencyAmount;
    return `${prefix}${whole.replace(/\./g, ",")}${fraction.replace(",", ".")}`;
  }

  const greeting = value.match(/^Selamat (pagi|siang|sore|malam), (.+)$/);
  if (greeting) {
    const timeOfDay: Record<string, string> = {
      pagi: "Good morning",
      siang: "Good afternoon",
      sore: "Good afternoon",
      malam: "Good evening",
    };
    return `${timeOfDay[greeting[1]]}, ${translateMobileText(greeting[2], language)}`;
  }

  const transactionCount = value.match(/^(\d+) transaksi$/);
  if (transactionCount) {
    const count = Number(transactionCount[1]);
    return `${count} transaction${count === 1 ? "" : "s"}`;
  }

  const categoryCount = value.match(/^(\d+) kategori$/);
  if (categoryCount) {
    const count = Number(categoryCount[1]);
    return `${count} categor${count === 1 ? "y" : "ies"}`;
  }

  const budgetCount = value.match(/^(\d+) anggaran$/);
  if (budgetCount) {
    const count = Number(budgetCount[1]);
    return `${count} budget${count === 1 ? "" : "s"}`;
  }

  const monthDuration = value.match(/^(\d+) bulan$/);
  if (monthDuration) {
    const count = Number(monthDuration[1]);
    return `${count} month${count === 1 ? "" : "s"}`;
  }

  const monthHistory = value.match(/^(\d+) bulan riwayat$/);
  if (monthHistory) return `${monthHistory[1]} months of history`;

  const confidence = value.match(/^Kepercayaan: (\d+%)$/);
  if (confidence) return `Confidence: ${confidence[1]}`;

  if (value.startsWith("Warna ")) return `Color ${value.slice("Warna ".length)}`;

  const investmentCount = value.match(/^(\d+) investasi$/);
  if (investmentCount) {
    const count = Number(investmentCount[1]);
    return `${count} investment${count === 1 ? "" : "s"}`;
  }

  const goalCount = value.match(/^(\d+) target$/);
  if (goalCount) {
    const count = Number(goalCount[1]);
    return `${count} goal${count === 1 ? "" : "s"}`;
  }

  const range = value.match(/^Menampilkan (\d+)–(\d+) dari (\d+)$/);
  if (range) return `Showing ${range[1]}–${range[2]} of ${range[3]}`;

  if (value.includes(" • ")) {
    return value
      .split(" • ")
      .map((part) => translateMobileText(part, language))
      .join(" • ");
  }

  const dateWithIndonesianMonth = value.replace(
    /\b(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\b/g,
    (month) => ({
      Jan: "Jan",
      Feb: "Feb",
      Mar: "Mar",
      Apr: "Apr",
      Mei: "May",
      Jun: "Jun",
      Jul: "Jul",
      Agu: "Aug",
      Sep: "Sep",
      Okt: "Oct",
      Nov: "Nov",
      Des: "Dec",
    })[month] ?? month,
  );
  if (dateWithIndonesianMonth !== value) return dateWithIndonesianMonth;

  const actionTranslations: Record<string, string> = {
    "Lihat ": "View ",
    "Ubah ": "Edit ",
    "Duplikasi ": "Duplicate ",
    "Hapus ": "Delete ",
    "Tandai dibaca: ": "Mark as read: ",
    "Hapus: ": "Delete: ",
  };

  for (const [indonesianPrefix, englishPrefix] of Object.entries(actionTranslations)) {
    if (value.startsWith(indonesianPrefix)) {
      return `${englishPrefix}${translateMobileText(value.slice(indonesianPrefix.length), language)}`;
    }
  }

  return value;
}
