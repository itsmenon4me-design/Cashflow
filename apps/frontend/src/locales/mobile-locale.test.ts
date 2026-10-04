import { describe, expect, it } from "vitest";
import { translateMobileText } from "../../../mobile/mobile-locale";

describe("native mobile localization", () => {
  it("translates native-only interface labels and empty states", () => {
    expect(translateMobileText("Tidak ada menu yang cocok", "en")).toBe("No matching menu found");
    expect(translateMobileText("Belum ada notifikasi.", "en")).toBe("No notifications yet.");
    expect(translateMobileText("Kategori tidak ditemukan.", "en")).toBe("No categories found.");
    expect(translateMobileText("Selamat pagi, Admin ganteng", "en")).toBe("Good morning, Admin");
    expect(translateMobileText("Warna #ff0000", "en")).toBe("Color #ff0000");
  });

  it("translates settings labels and keeps fragment spacing intact", () => {
    expect(translateMobileText("Kelola profil dan sesi pada akun Anda.", "en"))
      .toBe("Manage your profile and sessions on your account.");
    expect(translateMobileText("Gaya bicara bot", "en")).toBe("Bot response style");
    expect(translateMobileText("Waktu pengingat mengikuti zona waktu akun", "en"))
      .toBe("Reminder times use your account time zone");
    expect(translateMobileText("Terang", "en")).toBe("Light");
    expect(translateMobileText("Gelap", "en")).toBe("Dark");
    expect(translateMobileText("Santai", "en")).toBe("Casual");
    expect(translateMobileText("Tegas", "en")).toBe("Direct");
    expect(translateMobileText("Kustom", "en")).toBe("Custom");
    expect(translateMobileText("Gaya bicara bot", "id")).toBe("Gaya bicara bot");
    expect(translateMobileText("  Menampilkan ", "en")).toBe("  Showing ");
    expect(translateMobileText(" dari ", "en")).toBe(" of ");
  });

  it("localizes dynamic counts, durations, dates, and rupiah amounts", () => {
    expect(translateMobileText("2 kategori", "en")).toBe("2 categories");
    expect(translateMobileText("1 bulan", "en")).toBe("1 month");
    expect(translateMobileText("Estimasi tercapai: 1 Mei 2026", "en")).toBe("Estimated completion: 1 May 2026");
    expect(translateMobileText("Rp 1.250.000", "en")).toBe("Rp 1,250,000");
    expect(translateMobileText("-Rp1.250.000", "en")).toBe("-Rp1,250,000");
    expect(translateMobileText("4 bulan riwayat", "en")).toBe("4 months of history");
    expect(translateMobileText("Kepercayaan: 75%", "en")).toBe("Confidence: 75%");
    expect(translateMobileText("Arus kas bersih positif sebesar Rp 730.000.", "en"))
      .toBe("Net cash flow is positive at Rp 730,000.");
    expect(translateMobileText("Kategori Belanja merupakan pengeluaran terbesar (73.4% dari total pengeluaran).", "en"))
      .toBe("Category Belanja is the largest expense (73.4% of total expenses).");
  });

  it("translates backend analytics labels and generated insights", () => {
    expect(translateMobileText("Proyeksi arus kas", "en")).toBe("Cash flow projection");
    expect(translateMobileText("Masuk Rp1.000.000 · Keluar Rp500.000", "en"))
      .toBe("Income Rp1,000,000 · Expenses Rp500,000");
    expect(translateMobileText("Pemasukan naik 12% dibanding periode sebelumnya.", "en"))
      .toBe("Income increased by 12% compared with the previous period.");
    expect(translateMobileText("Saving rate turun 5 poin persentase.", "en"))
      .toBe("Savings rate decreased by 5 percentage points.");
  });

  it("preserves Indonesian content supplied by the user", () => {
    expect(translateMobileText("Catatan pribadi untuk transaksi ini", "en"))
      .toBe("Catatan pribadi untuk transaksi ini");
  });
});
