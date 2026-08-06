"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CirclePlus,
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
import { notifications } from "@/lib/mock-data";
import { uiText } from "@/locales";
import { useAuthStore } from "@/stores/auth.store";
import { useNotificationStore } from "@/stores/notification.store";
import { useSidebarStore } from "@/stores/sidebar.store";
import { useThemeStore } from "@/stores/theme.store";

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
  const { unreadCount } = useNotificationStore();
  const user = useAuthStore((state) => state.user);
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          className="size-11 shrink-0 rounded-xl md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label={uiText.common.openMenuAriaLabel}
        >
          <Menu className="size-5" />
        </Button>

        <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="CashFlow">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <span className="text-sm font-semibold">CashFlow</span>
        </Link>

        <div className="relative hidden w-full max-w-md flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl bg-card pl-9"
            placeholder={uiText.common.searchPlaceholder}
            aria-label={uiText.common.searchAriaLabel}
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            className="size-11 rounded-xl md:hidden"
            onClick={() => setMobileSearchOpen((open) => !open)}
            aria-label={uiText.common.searchAriaLabel}
            aria-expanded={mobileSearchOpen}
          >
            <Search className="size-5" />
          </Button>

          <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground xl:flex">
            <CalendarDays className="size-4 text-primary" />
            <span>{today}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative size-11 rounded-xl md:size-9"
                aria-label={uiText.common.notificationsAriaLabel}
              >
                <Bell className="size-4" />
                {unreadCount > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive p-0 text-[10px] text-white">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>{uiText.navigation.notifications}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((item) => (
                <DropdownMenuItem key={item.id} className="flex-col items-start gap-0.5 py-2">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </DropdownMenuItem>
              ))}
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
            aria-label={uiText.common.toggleThemeAriaLabel}
          >
            {mode === "dark" ? <SunMedium className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <Button className="hidden rounded-xl lg:inline-flex" onClick={() => undefined}>
            <CirclePlus />
            <span>{uiText.common.quickAdd}</span>
          </Button>

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
                    {getInitials(user?.name ?? "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left md:block">
                  <p className="text-sm font-medium leading-tight text-foreground">{user?.name}</p>
                  <p className="text-xs leading-tight text-muted-foreground">{user?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-medium">{user?.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
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
              <DropdownMenuItem variant="destructive">
                <LogOut />
                {uiText.navigation.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
