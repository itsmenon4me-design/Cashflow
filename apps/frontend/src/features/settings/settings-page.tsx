"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Globe,
  Moon,
  Palette,
  Sun,
  UserRound,
  Wallet,
} from "lucide-react";
import { ErrorState } from "@/components/states/ErrorState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { uiText } from "@/locales";
import { settingsService } from "@/services/settings.service";
import { useAuthStore } from "@/stores/auth.store";
import { useLanguageStore } from "@/stores/language.store";
import { useThemeStore } from "@/stores/theme.store";
import { CURRENCY_OPTIONS } from "@/types/settings";
import type {
  LanguagePreference,
  NotificationPreferences,
  ThemePreference,
  UserSettingsPatch,
} from "@/types/settings";
import { FinanceBotCard } from "@/features/finance-bot/FinanceBotCard";

const DEFAULT_PREFS: NotificationPreferences = {
  transactions: true,
  budgets: true,
  savingGoals: true,
  accounts: true,
  investments: true,
  system: true,
};

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Palette;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </div>
    </div>
  );
}

function SettingsGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const user = useAuthStore((state) => state.user);
  const setUiLanguage = useLanguageStore((state) => state.setLanguage);
  const currentLanguage = useLanguageStore((state) => state.language);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Use the global language store as the single source of truth. Avoid local drafts
  // that can get out-of-sync with the shared language binding.
  const language = currentLanguage;
  const [currency, setCurrencyDraft] = useState("IDR");
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFS);

  // Labels re-read the global `uiText` binding on every render so they follow
  // the active language after the language root remounts.
  const themeOptions: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: uiText.settingsPage.themeLight },
    { value: "dark", icon: Moon, label: uiText.settingsPage.themeDark },
  ];
  const notificationKeys: { key: keyof NotificationPreferences; label: string }[] = [
    { key: "transactions", label: uiText.settingsPage.notifTransactions },
    { key: "budgets", label: uiText.settingsPage.notifBudgets },
    { key: "savingGoals", label: uiText.settingsPage.notifSavingGoals },
    { key: "accounts", label: uiText.settingsPage.notifAccounts },
    { key: "investments", label: uiText.settingsPage.notifInvestments },
    { key: "system", label: uiText.settingsPage.notifSystem },
  ];

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(false);

      try {
        const settings = await settingsService.getSettings();
        if (cancelled) return;
        // Apply language immediately to the shared store so UI updates optimistically.
        setUiLanguage(settings.language);
        setCurrencyDraft(settings.currency);
        setPreferences(settings.notificationPreferences);
        document.documentElement.lang = settings.language;
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, setUiLanguage]);

  const refresh = () => setRefreshKey((key) => key + 1);

  const persist = (patch: UserSettingsPatch) => {
    void settingsService.updateSettings(patch).catch(() => {});
  };

  const handleThemeChange = (value: ThemePreference) => {
    setTheme(value);
    persist({ theme: value });
  };

  const handleLanguageChange = (value: LanguagePreference) => {
    // Update shared store immediately (optimistic) and persist in background.
    setUiLanguage(value);
    persist({ language: value });
  };

  const handleCurrencyChange = (value: string) => {
    setCurrencyDraft(value);
    persist({ currency: value });
  };

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    persist({ notificationPreferences: { [key]: value } });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {uiText.settingsPage.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{uiText.settingsPage.subtitle}</p>
        </div>
        <ErrorState
          title={uiText.states.errorTitle}
          description={uiText.settingsPage.loadError}
          onRetry={refresh}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.settingsPage.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.settingsPage.subtitle}</p>
      </div>

      <SettingsGroup title={uiText.settingsPage.groupApplication}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader>
              <SectionHeading icon={Palette} title={uiText.settingsPage.appearance} subtitle={uiText.settingsPage.appearanceSubtitle} />
            </CardHeader>
            <CardContent>
              <RadioGroup value={theme} onValueChange={(value) => handleThemeChange(value as ThemePreference)}>
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div key={option.value} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Icon className="size-4 text-muted-foreground" />
                        <Label htmlFor={`theme-${option.value}`} className="cursor-pointer">{option.label}</Label>
                      </div>
                      <RadioGroupItem value={option.value} id={`theme-${option.value}`} />
                    </div>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <SectionHeading icon={Globe} title={uiText.settingsPage.language} subtitle={uiText.settingsPage.languageSubtitle} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : (
                <RadioGroup value={language} onValueChange={(value) => handleLanguageChange(value as LanguagePreference)}>
                  <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <Label htmlFor="lang-id" className="cursor-pointer">Indonesia</Label>
                    <RadioGroupItem value="id" id="lang-id" data-testid="lang-id" />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <Label htmlFor="lang-en" className="cursor-pointer">English</Label>
                    <RadioGroupItem value="en" id="lang-en" data-testid="lang-en" />
                  </div>
                </RadioGroup>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <SectionHeading icon={Wallet} title={uiText.settingsPage.regional} subtitle={uiText.settingsPage.regionalSubtitle} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-24 w-full rounded-xl" />
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="settings-currency" className="text-xs text-muted-foreground">
                    {uiText.settingsPage.currency}
                  </Label>
                  <Select value={currency} onValueChange={handleCurrencyChange}>
                    <SelectTrigger id="settings-currency" className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SettingsGroup>

      <SettingsGroup title={uiText.settingsPage.groupAccount}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <SectionHeading icon={UserRound} title={uiText.settingsPage.account} subtitle={uiText.settingsPage.accountSubtitle} />
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{uiText.settingsPage.name}</span>
                <span className="font-medium text-foreground">{user?.name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{uiText.settingsPage.email}</span>
                <span className="truncate font-medium text-foreground">{user?.email ?? "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </SettingsGroup>

      <SettingsGroup title={uiText.financeBot.title} subtitle={uiText.financeBot.subtitle}>
        <FinanceBotCard />
      </SettingsGroup>

      <SettingsGroup title={uiText.settingsPage.notifications} subtitle={uiText.settingsPage.notificationsSubtitle}>
        <Card className="shadow-sm">
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {loading
              ? <Skeleton className="h-32 w-full rounded-xl" />
              : notificationKeys.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <Label htmlFor={`notif-${item.key}`} className="cursor-pointer">{item.label}</Label>
                    <Switch
                      id={`notif-${item.key}`}
                      checked={preferences[item.key]}
                      onCheckedChange={(checked) => handlePreferenceChange(item.key, checked)}
                    />
                  </div>
                ))}
          </CardContent>
        </Card>
      </SettingsGroup>
    </div>
  );
}
