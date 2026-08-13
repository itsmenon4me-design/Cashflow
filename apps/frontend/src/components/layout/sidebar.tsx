"use client";

import { PanelLeftClose, PanelLeftOpen, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import { useSidebarStore } from "@/stores/sidebar.store";

export function Sidebar() {
  const { collapsed, toggleCollapsed } = useSidebarStore();

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out md:flex",
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
            <p className="truncate text-xs text-muted-foreground">{uiText.common.dashboardSubtitle}</p>
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 pb-5 pt-4">
        <SidebarNav collapsed={collapsed} />
      </ScrollArea>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={toggleCollapsed}
          aria-label={uiText.common.collapseMenu}
          className={cn("text-muted-foreground hover:text-foreground", collapsed ? "mx-auto flex" : "w-full justify-start gap-2")}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>{uiText.common.collapseMenu}</span>}
        </Button>
      </div>
    </aside>
  );
}
