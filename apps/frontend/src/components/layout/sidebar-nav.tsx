"use client";

import { memo, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import { getAppMenuItems, type AppMenuItem } from "@/lib/navigation";
import { warmRouteData } from "@/lib/route-data-prefetch";

const STORAGE_KEY = "cashflow:sidebar-groups";
const COOKIE_NAME = "cashflow_sidebar_expanded";

type GroupKey = "transactions" | "planning" | "reports" | "system";

interface NavGroup {
  key?: GroupKey;
  title?: string;
  items: AppMenuItem[];
}

function getCookieValue(name: string): Record<string, boolean> {
  try {
    const entry = document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(name + "="));
    return entry ? JSON.parse(decodeURIComponent(entry.split("=")[1])) : {};
  } catch {
    return {};
  }
}

function isActivePath(href: string, pathname: string): boolean {
  return href === "/"
    ? pathname === "/" || pathname === "/dashboard"
    : pathname === href;
}

function setCookieValue(name: string, value: Record<string, boolean>) {
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  document.cookie = `${name}=${encodeURIComponent(
    JSON.stringify(value)
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  initialExpanded?: Partial<Record<GroupKey, boolean>>;
}

declare global {
  interface Window {
    __sidebarExpanded?: Partial<Record<GroupKey, boolean>>;
  }
}

export const SidebarNav = memo(function SidebarNav({ collapsed = false, onNavigate, initialExpanded = {} }: SidebarNavProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Partial<Record<GroupKey, boolean>>>(() => {
    if (Object.keys(initialExpanded).length > 0) {
      return initialExpanded;
    }
    if (typeof window !== "undefined" && window.__sidebarExpanded) {
      return window.__sidebarExpanded;
    }
    return {};
  });
  const items = getAppMenuItems();
  const findByHref = (href: string) => items.find((item) => item.href === href);

  useEffect(() => {
    if (Object.keys(initialExpanded).length > 0) return;
    if (Object.keys(expanded).length > 0) return;

    const stored = getCookieValue(COOKIE_NAME);
    if (Object.keys(stored).length > 0) {
      setExpanded(stored);
      return;
    }

    const legacyStored = window.localStorage.getItem(STORAGE_KEY);
    if (!legacyStored) return;

    const parsed = JSON.parse(legacyStored) as Partial<Record<GroupKey, boolean>>;
    setExpanded(parsed);
    setCookieValue(COOKIE_NAME, parsed);
  }, [expanded, initialExpanded]);

  const groups: NavGroup[] = [
    { items: [findByHref("/dashboard")].filter(Boolean) as AppMenuItem[] },
    {
      key: "transactions",
      title: "Transaksi",
      items: ["/incomes", "/expenses", "/transactions", "/categories"]
      .map(findByHref)
      .filter(Boolean) as AppMenuItem[],
    },
    {
      key: "planning",
      title: "Perencanaan",
      items: ["/budgets", "/goals", "/investments"].map(findByHref).filter(Boolean) as AppMenuItem[],
    },
    {
      key: "reports",
      title: "Laporan",
      items: ["/reports", "/analytics", "/forecast"].map(findByHref).filter(Boolean) as AppMenuItem[],
    },
    {
      key: "system",
      title: "Sistem",
      items: [].map(findByHref).filter(Boolean) as AppMenuItem[],
    },
    { items: [findByHref("/settings")].filter(Boolean) as AppMenuItem[] },
  ];

  const toggleGroup = (key: GroupKey) => {
    setExpanded((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
      setCookieValue(COOKIE_NAME, next);
      // Also keep localStorage for backwards compatibility during migration
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const renderLink = (item: AppMenuItem) => {
    const Icon = item.icon;
    const isActive = isActivePath(item.href, pathname);
    const link = (
      <Link
      key={item.href}
      href={item.href}
      onClick={onNavigate}
      prefetch
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      onMouseEnter={() => warmRouteData(item.href)}
      onFocus={() => warmRouteData(item.href)}
      onTouchStart={() => warmRouteData(item.href)}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
        collapsed ? "justify-center px-0" : "px-3",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );

    return collapsed ? (
      <Tooltip key={item.href} delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    ) : link;
  };

  return (
    <nav className={cn("flex flex-col", collapsed ? "gap-1" : "gap-3")} aria-label={uiText.common.openMenuAriaLabel}>
      {groups
      .filter((group) => group.items.length > 0)
      .map((group, index) => {
        const active = group.items.some((item) => isActivePath(item.href, pathname));
        const isOpen = collapsed || !group.key || active || expanded[group.key];

        return (
          <div
            key={group.key ?? `standalone-${index}`}
            className={cn("flex flex-col gap-1", collapsed && index > 0 && "border-t border-sidebar-border pt-1")}
          >
            {group.key && !collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(group.key as GroupKey)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
              >
                <span>{group.title}</span>
                <ChevronRight className={cn("size-3 transition-transform duration-200", isOpen && "rotate-90")} />
              </button>
            )}
            <div
              aria-hidden={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="flex flex-col gap-1">{group.items.map(renderLink)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
});
