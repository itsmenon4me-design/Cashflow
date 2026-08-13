import type { FinanceBotSettings } from "@/types/settings";
import { uiText } from "@/locales";

export type FinanceBotRuleType =
  | "DAILY_RECORDING_REMINDER"
  | "DAILY_RECORDING_ESCALATION"
  | "BUDGET_THRESHOLD"
  | "BUDGET_EXCEEDED"
  | "RECORDING_RECOVERY";

export interface RuleContext {
  userId: string;
  ruleType: FinanceBotRuleType;
  referenceDate?: string; // YYYY-MM-DD
  entityId?: string; // e.g., budgetId
  extra?: Record<string, unknown>;
}

export function generateDedupeId(ctx: RuleContext) {
  // deterministic id for deduplication: userId|ruleType|referenceDate|entityId
  const parts = [ctx.userId, ctx.ruleType, ctx.referenceDate ?? "", ctx.entityId ?? ""];
  return parts.join("|");
}

export function generateMessage(settings: FinanceBotSettings | undefined, rule: FinanceBotRuleType, context: RuleContext) {
  const personality = settings?.personality ?? "SANTAI";
  const templates: Record<string, Record<FinanceBotRuleType, string>> = {
    SANTAI: {
      DAILY_RECORDING_REMINDER: "{greeting} Udah malam nih, transaksi hari ini belum dicatat. Yuk isi bentar~",
      DAILY_RECORDING_ESCALATION: "Sebelum tidur, sempetin dulu dong catat transaksi hari ini. 2 menit doang kok.",
      BUDGET_THRESHOLD: "Budget kamu untuk kategori ini sudah mendekati batas. Coba cek lagi pengeluaran ya.",
      BUDGET_EXCEEDED: "Budget kategori ini sudah terlewati. Coba cek kembali pengeluaranmu.",
      RECORDING_RECOVERY: "Nah gitu dong! Akhirnya nyatet lagi. Yuk lanjutin, jangan bolong lagi ya.",
    },
    TEGAS: {
      DAILY_RECORDING_REMINDER: "Belum catat transaksi hari ini. Segera catat sekarang.",
      DAILY_RECORDING_ESCALATION: "Masih belum juga? Catat segera atau data akan tidak akurat.",
      BUDGET_THRESHOLD: "Budget kategori ini hampir habis. Kurangi pengeluaran.",
      BUDGET_EXCEEDED: "Budget sudah terlewati. Segera evaluasi pengeluaranmu.",
      RECORDING_RECOVERY: "Baik, transaksi dicatat. Tetap konsisten.",
    },
    SAVAGE: {
      DAILY_RECORDING_REMINDER: "Lagi males ya? Catat transaksi sekarang juga. 😏",
      DAILY_RECORDING_ESCALATION: "Masih belum? Dompetmu kebakaran, bro.",
      BUDGET_THRESHOLD: "Budget udah hampir abis. Kalau gak mau nangis, kontrol pengeluaran.",
      BUDGET_EXCEEDED: "Budget udah lewat masih lanjut? 😭 Dompet kamu minta ampun.",
      RECORDING_RECOVERY: "Akhirnya! Jangan bikin aku nunggu lagi.",
    },
  };

  const template = (templates[personality] && templates[personality][rule]) || uiText.activity.fallback;
  // replace simple placeholders and include reference date if available
  const greeting = "Hai";
  let message = template.replace("{greeting}", greeting);
  if (context.referenceDate) {
    message = message + ` (${context.referenceDate})`;
  }
  return message;
}

