"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Globe,
  LogOut,
  Moon,
  Palette,
  Search,
  ShieldAlert,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { FinanceBotCard } from "@/features/finance-bot/FinanceBotCard";
import { ErrorState } from "@/components/states/ErrorState";
import { uiText } from "@/locales";
import { apiClient } from "@/lib/axios";
import { authService } from "@/services/auth.service";
import { settingsService } from "@/services/settings.service";
import { useAuthStore } from "@/stores/auth.store";
import { useLanguageStore } from "@/stores/language.store";
import { useThemeStore } from "@/stores/theme.store";
import type {
  LanguagePreference,
  NotificationPreferences,
  ThemePreference,
  UserSettingsPatch,
} from "@/types/settings";

const DEFAULT_PREFS: NotificationPreferences = {
  transactions: true,
  budgets: true,
  savingGoals: true,
  accounts: true,
  investments: true,
  system: true,
};

type SettingsTabId = "general" | "account" | "finance-bot" | "notifications";

const SETTINGS_TABS = [
  {
    id: "general" as const,
    label: "Umum",
    summary: "Tampilan & bahasa",
    keywords: ["umum", "preferensi", "aplikasi", "tampilan", "tema", "bahasa", "indonesia", "english", "terang", "gelap"],
  },
  {
    id: "account" as const,
    label: "Akun",
    summary: "Profil & keamanan",
    keywords: ["akun", "profil", "email", "nama", "logout", "semua perangkat", "hapus akun", "danger", "zona berbahaya"],
  },
  {
    id: "finance-bot" as const,
    label: "Finance Bot",
    summary: "Notifikasi & gaya bot",
    keywords: ["finance bot", "bot", "anggaran", "peringatan", "reminder", "gaya bicara", "pengingat"],
  },
  {
    id: "notifications" as const,
    label: "Notifikasi",
    summary: "Pengaturan pemberitahuan",
    keywords: ["notifikasi", "transaksi", "anggaran", "target tabungan", "akun", "investasi", "sistem"],
  },
];

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
  const router = useRouter();
  const { theme, setTheme } = useThemeStore();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const setUiLanguage = useLanguageStore((state) => state.setLanguage);
  const currentLanguage = useLanguageStore((state) => state.language);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const language = currentLanguage;
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);

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

  const filteredTabs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return SETTINGS_TABS;
    }
    return SETTINGS_TABS.filter((tab) =>
      tab.label.toLowerCase().includes(query) ||
      tab.summary.toLowerCase().includes(query) ||
      tab.keywords.some((item) => item.toLowerCase().includes(query)),
    );
  }, [searchQuery]);

  useEffect(() => {
    if (filteredTabs.length > 0 && !filteredTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(filteredTabs[0].id);
    }
  }, [activeTab, filteredTabs]);

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
        setUiLanguage(settings.language);
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

  const persist = async (patch: UserSettingsPatch): Promise<import("@/types/settings").UserSettings | null> => {
    try {
      const updated = await settingsService.updateSettings(patch);
      try {
        return await settingsService.getSettings();
      } catch (e) {
        console.warn("[settings] persist -> re-fetch failed, falling back to update result", e);
        return updated;
      }
    } catch (err) {
      console.error("[settings] persist -> updateSettings error", err);
      return null;
    }
  };

  const handleThemeChange = (value: ThemePreference) => {
    setTheme(value);
    void persist({ theme: value });
  };

  const handleLanguageChange = (value: LanguagePreference) => {
    setUiLanguage(value);
    void persist({ language: value });
  };

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    void persist({ notificationPreferences: { [key]: value } });
  };

  const handleLogoutAllDevices = async () => {
    setAccountError(null);
    setAccountNotice(null);
    try {
      await apiClient.delete<{ success: boolean }>("/auth/sessions");
      setAccountNotice("Anda sudah logout dari semua perangkat.");
    } catch {
      setAccountError("Gagal logout dari semua perangkat. Coba lagi.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.email) {
      setDeleteError("Sesi Anda tidak valid. Silakan login kembali.");
      return;
    }
    if (deleteEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      setDeleteError("Email konfirmasi tidak cocok dengan akun Anda.");
      return;
    }
    if (!deletePassword.trim()) {
      setDeleteError("Masukkan password Anda untuk konfirmasi final.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await authService.deleteAccount({
        email: deleteEmail.trim(),
        password: deletePassword,
      });
      if (!result.success) {
        throw new Error(result.message ?? "Hapus akun gagal.");
      }
      useAuthStore.getState().logout();
      setUser(null);
      router.push("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Hapus akun gagal.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{uiText.settingsPage.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{uiText.settingsPage.subtitle}</p>
        </div>
        <ErrorState title={uiText.states.errorTitle} description={uiText.settingsPage.loadError} onRetry={refresh} />
      </div>
    );
  }

  const activeSettingsTab = SETTINGS_TABS.find((tab) => tab.id === activeTab) ?? SETTINGS_TABS[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{uiText.settingsPage.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.settingsPage.subtitle}</p>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <aside className="w-full xl:max-w-[300px]">
          <div className="rounded-2xl border bg-card p-3 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari pengaturan"
                className="h-10 pl-9"
              />
            </div>

            <nav className="mt-4 space-y-2">
              {filteredTabs.length === 0 ? (
                <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  Tidak ada pengaturan yang cocok.
                </div>
              ) : (
                filteredTabs.map((tab) => {
                  const isActive = activeSettingsTab.id === tab.id;
                  const Icon = tab.id === "general" ? Palette : tab.id === "account" ? UserRound : tab.id === "finance-bot" ? Bot : Bell;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={[
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                        isActive ? "border-primary/40 bg-accent text-accent-foreground shadow-sm" : "border-border bg-background/60 hover:bg-muted/60",
                        searchQuery.trim() ? "ring-1 ring-primary/20" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <div className={[
                          "flex size-8 items-center justify-center rounded-lg",
                          isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        ].join(" ")}>
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{tab.label}</div>
                          <div className="text-[11px] text-muted-foreground">{tab.summary}</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </nav>
          </div>
        </aside>

        <div className="flex-1">
          {activeSettingsTab.id === "general" && (
            <div className="space-y-6">
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
                        <Skeleton className="h-[100px] w-full rounded-xl" />
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
                </div>
              </SettingsGroup>
            </div>
          )}

          {activeSettingsTab.id === "account" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Akun</h2>
                <p className="text-sm text-muted-foreground">Kelola profil, sesi, dan penghapusan akun.</p>
              </div>

              <Card className="shadow-sm">
                <CardContent className="space-y-4 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nama</p>
                      <p className="text-lg font-semibold text-foreground">{user?.name ?? "Pengguna"}</p>
                    </div>
                    <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Aktif</div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm font-medium text-foreground">{user?.email ?? "—"}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button variant="outline" asChild>
                      <a href="/profile">Edit Profil</a>
                    </Button>
                    <Button variant="secondary" onClick={handleLogoutAllDevices} className="gap-2">
                      <LogOut className="size-4" />
                      Log out dari semua perangkat
                    </Button>
                  </div>

                  {accountNotice ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      <CheckCircle2 className="size-4" />
                      {accountNotice}
                    </div>
                  ) : null}

                  {accountError ? (
                    <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      <ShieldAlert className="size-4" />
                      {accountError}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-900/60 dark:bg-red-950/20">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-700 dark:text-red-300">Zona Berbahaya</h3>
                    <p className="text-sm text-red-600/80 dark:text-red-400/90">Aksi ini menghapus semua data Anda secara permanen.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="gap-2">
                    <Trash2 className="size-4" />
                    Hapus Akun
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeSettingsTab.id === "finance-bot" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Finance Bot</h2>
                <p className="text-sm text-muted-foreground">Pindahan dari pengaturan bot yang sudah ada.</p>
              </div>
              <FinanceBotCard />
            </div>
          )}

          {activeSettingsTab.id === "notifications" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Notifikasi</h2>
                <p className="text-sm text-muted-foreground">Atur pengingat dan notifikasi penting.</p>
              </div>

              <Card className="shadow-sm">
                <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {loading ? (
                    <Skeleton className="h-32 w-full rounded-xl" />
                  ) : (
                    notificationKeys.map((item) => (
                      <div key={item.key} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                        <Label htmlFor={`notif-${item.key}`} className="cursor-pointer">{item.label}</Label>
                        <Switch
                          id={`notif-${item.key}`}
                          checked={preferences[item.key]}
                          onCheckedChange={(checked) => handlePreferenceChange(item.key, checked)}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setDeleteError(null);
          setDeleteEmail("");
          setDeletePassword("");
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="size-5" />
            </div>
            <DialogTitle>Hapus Akun</DialogTitle>
            <DialogDescription>
              Semua transaksi, kategori, target tabungan, investasi, notifikasi, serta data terkait akun Anda akan hilang permanen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="delete-account-email">Ketik ulang email Anda</Label>
              <Input
                id="delete-account-email"
                value={deleteEmail}
                onChange={(event) => setDeleteEmail(event.target.value)}
                placeholder={user?.email ?? "email@example.com"}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-account-password">Password saat ini</Label>
              <Input
                id="delete-account-password"
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Masukkan password Anda"
                autoComplete="current-password"
              />
            </div>

            {deleteError ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting || !deleteEmail || !deletePassword}
            >
              {isDeleting ? "Menghapus..." : "Yakin, hapus akun"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
