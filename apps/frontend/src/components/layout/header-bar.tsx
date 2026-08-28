"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  SunMedium,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatFullDate } from "@/lib/format";
import { uiText } from "@/locales";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { useNotificationStore } from "@/stores/notification.store";
import { useSidebarStore } from "@/stores/sidebar.store";
import { useThemeStore } from "@/stores/theme.store";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { SyncStatusIndicator } from "@/components/layout/sync-status-indicator";
import { GlobalSearch } from "@/components/layout/global-search";
import { formatRelativeTime } from "@/features/notifications/relative-time";
import {
  getFinanceBotPriorityLabel,
  getFinanceBotPriorityVariant,
  getFinanceBotRuleLabel,
  getFinanceBotRuleRoute,
  isFinanceBotNotification,
} from "@/features/notifications/notification-config";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function HeaderBar() {
  const { mode, toggleMode } = useThemeStore();
  const { unreadCount, recent, initialized, fetch, markAllRead } = useNotificationStore();
  const user = useAuthStore((state) => state.user);
  const authHydrated = useAuthStore((state) => state.hydrated);
  const logout = useAuthStore((state) => state.logout);
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);
  const router = useRouter();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const safeUser = mounted ? user : undefined;
  const safeMode = mounted ? mode : "dark";

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!initialized) {
      void fetch();
    }
  }, [initialized, fetch]);

  // Near-realtime notifications: poll periodically, refresh on window focus,
  // and refetch whenever any global data refresh is triggered (e.g. new transaction).
  const dataVersion = useDataRefreshStore((state) => state.version);
  useEffect(() => {
    const isAuthed = () => useAuthStore.getState().isAuthenticated;
    const refresh = () => {
      if (isAuthed()) {
        void fetch();
      }
    };

    void refresh();
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dataVersion, fetch]);

  const handleLogout = () => {
    void authService.logout().catch(() => undefined);
    logout();
    router.replace("/login");
  };

  const submitHeaderSearch = () => {
    const q = headerSearch.trim();
    if (q) {
      router.push(`/transactions?q=${encodeURIComponent(q)}`);
      setHeaderSearch("");
      setMobileSearchOpen(false);
    }
  };

  const today = mounted ? formatFullDate() : "";

  return (
    <header className="sticky top-0 z-30 overflow-hidden border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 min-w-0 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          className="size-11 shrink-0 rounded-xl lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label={uiText.common.openMenuAriaLabel}
        >
          <Menu className="size-5" />
        </Button>

        <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="CashFlow">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <span className="text-sm font-semibold">CashFlow</span>
        </Link>

        <GlobalSearch />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            className="size-11 rounded-xl lg:hidden"
            onClick={() => setMobileSearchOpen((open) => !open)}
            aria-label={uiText.common.searchAriaLabel}
            aria-expanded={mobileSearchOpen}
          >
            <Search className="size-5" />
          </Button>

          <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground xl:flex">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            <span className="min-w-[10.5rem] whitespace-nowrap text-center tabular-nums">{today}</span>
          </div>

          <SyncStatusIndicator showLabel={false} className="sm:hidden" />
          <SyncStatusIndicator className="hidden sm:inline-flex" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                              className="relative size-11 rounded-xl md:size-9 pr-6"
                aria-label={uiText.common.notificationsAriaLabel}
              >
                <Bell className="size-4" />
                {unreadCount > 0 && (
                                <Badge className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive p-0 text-[10px] text-white pointer-events-none z-10">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>{uiText.navigation.notifications}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recent.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  {uiText.notificationsPage.empty}
                </p>
              ) : (
                recent.map((item) => {
                  const isFinanceBot = isFinanceBotNotification(item);
                  const ruleLabel = isFinanceBot ? getFinanceBotRuleLabel(item) : undefined;
                  const priorityLabel = isFinanceBot ? getFinanceBotPriorityLabel(item) : undefined;
                  const priorityVariant = isFinanceBot ? getFinanceBotPriorityVariant(item) : "secondary";
                  const ruleRoute = getFinanceBotRuleRoute(item);
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      className="flex-col items-start gap-0.5 py-2"
                      onSelect={() => router.push(ruleRoute ?? "/notifications")}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {!item.isRead && (
                          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        )}
                        <span className="truncate">{item.title}</span>
                        {!item.isRead && (
                          <span className="sr-only">{uiText.notificationsPage.unread}</span>
                        )}
                      </span>
                      {(isFinanceBot || priorityLabel) && (
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {isFinanceBot && (
                            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                              {uiText.financeBot.title}
                            </Badge>
                          )}
                          {ruleLabel && (
                            <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                              {ruleLabel}
                            </Badge>
                          )}
                          {priorityLabel && (
                            <Badge variant={priorityVariant} className="shrink-0 px-1.5 py-0 text-[10px]">
                              {priorityLabel}
                            </Badge>
                          )}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </DropdownMenuItem>
                  );
                })
              )}
              {unreadCount > 0 && (
                <DropdownMenuItem
                  className="justify-center text-primary"
                  onSelect={() => void markAllRead()}
                >
                  {uiText.notificationsPage.markAllRead}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/notifications" className="justify-center text-primary">
                  {uiText.common.viewAll}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            className="size-11 rounded-xl md:size-9"
            onClick={toggleMode}
            aria-label={safeMode === "dark" ? uiText.common.themeToLight : uiText.common.themeToDark}
            title={safeMode === "dark" ? uiText.common.themeToLight : uiText.common.themeToDark}
          >
            {safeMode === "dark" ? <SunMedium className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {!authHydrated || !safeUser ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 pr-3" aria-label="Memuat profil">
              <div className="size-8 animate-pulse rounded-full bg-muted" />
              <div className="hidden w-40 space-y-1.5 md:block">
                <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 pr-3 transition-colors outline-none",
                    "hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                  )}
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {getInitials(safeUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden w-40 text-left md:block">
                    <p className="truncate text-sm font-medium leading-tight text-foreground">{safeUser.name}</p>
                    <p className="truncate text-xs leading-tight text-muted-foreground">{safeUser.email}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-medium">{safeUser.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{safeUser.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserRound />
                    {uiText.navigation.profile}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    {uiText.navigation.settings}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut />
                  {uiText.navigation.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="border-t border-border p-3 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="h-12 rounded-xl bg-card pr-10 pl-9"
              placeholder={uiText.common.searchPlaceholder}
              aria-label={uiText.common.searchAriaLabel}
              value={headerSearch}
              onChange={(event) => setHeaderSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitHeaderSearch();
              }}
            />
            <Button
              variant="ghost"
              className="absolute top-1/2 right-0.5 h-11 w-11 -translate-y-1/2 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => setMobileSearchOpen(false)}
              aria-label={uiText.common.closeAriaLabel}
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
