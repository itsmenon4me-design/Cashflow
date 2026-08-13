"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { uiText } from "@/locales";
import { settingsService } from "@/services/settings.service";
import type { FinanceBotSettings } from "@/types/settings";

const PERSONALITIES = [
  { value: "SANTAI", label: "Santai" },
  { value: "TEGAS", label: "Tegas" },
  { value: "SAVAGE", label: "Savage" },
  { value: "CUSTOM", label: "Custom" },
] as const;

const DEFAULTS: FinanceBotSettings = {
  enabled: false,
  personality: "SANTAI",
  customStyle: undefined,
  budgetThreshold: 80,
  dailyReminderEnabled: true,
  reminderTime1: "20:00",
  reminderTime2: "22:00",
};

export function FinanceBotCard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [settings, setSettings] = useState<FinanceBotSettings>(DEFAULTS);
  const settingsRef = useRef(settings);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const s = await settingsService.getSettings();
        if (cancelled) return;
        const next = { ...settingsRef.current, ...(s.financeBotSettings ?? {}) } as FinanceBotSettings;
        settingsRef.current = next;
        setSettings(next);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const persist = (next: FinanceBotSettings) => {
    void settingsService
      .updateSettings({
        financeBotSettings: {
          ...next,
          reminderTime1: next.reminderTime1 || null,
          reminderTime2: next.reminderTime2 || null,
        },
      })
      .catch(() => {});
  };

  const apply = (patch: Partial<FinanceBotSettings>, immediate = true) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (immediate) {
      persist(next);
    } else {
      debounceTimer.current = setTimeout(() => persist(settingsRef.current), 500);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent>
        {loading ? (
          <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : loadError ? (
          <p role="alert" className="text-sm text-danger">{uiText.settingsPage.loadError}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <Label htmlFor="fb-enabled" className="cursor-pointer">{uiText.financeBot.enabled}</Label>
              <Switch id="fb-enabled" checked={settings.enabled} onCheckedChange={(v) => apply({ enabled: Boolean(v) })} />
            </div>

            <div className="rounded-xl border border-border px-4 py-3">
              <Label className="block mb-2">{uiText.financeBot.personalityTitle}</Label>
              <div className="space-y-2">
                <RadioGroup value={settings.personality} onValueChange={(v) => apply({ personality: v as FinanceBotSettings['personality'] })}>
                  {PERSONALITIES.map((p) => (
                    <div key={p.value} className="flex items-center justify-between rounded-xl px-3 py-2">
                      <Label htmlFor={`pb-${p.value}`} className="cursor-pointer">{uiText.financeBot.personalityOptions[p.value]}</Label>
                      <RadioGroupItem value={p.value} id={`pb-${p.value}`} />
                    </div>
                  ))}
                </RadioGroup>

                {settings.personality === "CUSTOM" && (
                  <div className="mt-2">
                    <Label htmlFor="fb-custom" className="mb-1">{uiText.financeBot.customLabel}</Label>
                    <Textarea id="fb-custom" value={settings.customStyle ?? ""} onChange={(e) => apply({ customStyle: e.target.value }, false)} placeholder={uiText.financeBot.customPlaceholder} maxLength={1000} />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border px-4 py-3">
              <Label id="fb-threshold-label" className="block mb-2">{uiText.financeBot.budgetThresholdTitle}</Label>
              <Select value={String(settings.budgetThreshold ?? 80)} onValueChange={(v) => apply({ budgetThreshold: Number(v) })} aria-labelledby="fb-threshold-label">
                <SelectTrigger className="w-36" id="fb-threshold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[50, 70, 80, 90, 100].map((v) => (
                    <SelectItem key={v} value={String(v)}>{v}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="fb-daily-reminder">{uiText.financeBot.dailyReminderTitle}</Label>
                <Switch id="fb-daily-reminder" checked={settings.dailyReminderEnabled} onCheckedChange={(v) => apply({ dailyReminderEnabled: Boolean(v) })} />
              </div>

              {settings.dailyReminderEnabled && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fb-rem1" className="text-xs">{uiText.financeBot.reminderTime1}</Label>
                    <Input id="fb-rem1" type="time" value={settings.reminderTime1 ?? "20:00"} onChange={(e) => apply({ reminderTime1: e.target.value }, false)} />
                  </div>
                  <div>
                    <Label htmlFor="fb-rem2" className="text-xs">{uiText.financeBot.reminderTime2}</Label>
                    <Input id="fb-rem2" type="time" value={settings.reminderTime2 ?? "22:00"} onChange={(e) => apply({ reminderTime2: e.target.value }, false)} />
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{uiText.financeBot.timezoneNote}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
