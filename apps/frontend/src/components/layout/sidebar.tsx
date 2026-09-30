"use client";

import { memo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { cn } from "@/lib/utils";
import { useUiText } from "@/hooks/useUiText";

interface SidebarProps {
  initialExpanded: Partial<Record<"transactions" | "planning" | "reports" | "system", boolean>>;
  initialCollapsed: boolean;
}

const COLLAPSED_COOKIE = "cashflow_sidebar_collapsed";

function getInitialCollapsedState(fallback: boolean): boolean {
  if (typeof document === "undefined") return fallback;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COLLAPSED_COOKIE}=(true|false)(?:;|$)`),
  );
  if (!match) return fallback;
  return match[1] === "true";
}

export const Sidebar = memo(function Sidebar({ initialExpanded, initialCollapsed }: SidebarProps) {
  const text = useUiText();
  const [collapsed, setCollapsed] = useState(() =>
    getInitialCollapsedState(initialCollapsed),
  );
  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${COLLAPSED_COOKIE}=${next}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out lg:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-5"
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Wallet className="size-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">CashFlow</p>
            <p className="truncate text-xs text-muted-foreground">{text.common.dashboardSubtitle}</p>
          </div>
        )}
      </div>

      <div
        data-scroll-preserve
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5 pt-4"
      >
        <SidebarNav collapsed={collapsed} initialExpanded={initialExpanded} />
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={toggleCollapsed}
          aria-label={text.common.collapseMenu}
          className={cn("text-muted-foreground hover:text-foreground", collapsed ? "mx-auto flex" : "w-full justify-start gap-2")}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>{text.common.collapseMenu}</span>}
        </Button>
      </div>
    </aside>
  );
});
