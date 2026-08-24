"use client";

import { memo } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import { getAppMenuItems } from "@/lib/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: import("lucide-react").LucideIcon;
}

function getNavItems(): NavItem[] {
  // Single source of truth lives in lib/navigation.ts (shared with the
  // global search quick-nav so both always list the same pages).
  return getAppMenuItems().map(({ label, href, icon }) => ({ label, href, icon }));
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

function getNavGroups(): NavGroup[] {
  const items = getNavItems();
  return [
    { key: "utama", label: uiText.navigation.groupMain, items: items.slice(0, 1) },
    { key: "keuangan", label: uiText.navigation.groupFinance, items: items.slice(1, 6) },
    { key: "perencanaan", label: uiText.navigation.groupPlanning, items: items.slice(6, 9) },
    { key: "analisis", label: uiText.navigation.groupInsight, items: items.slice(9, 12) },
    { key: "sistem", label: uiText.navigation.groupSystem, items: items.slice(12, 15) },
  ];
}

function isActivePath(href: string, pathname: string): boolean {
  return href === "/"
    ? pathname === "/" || pathname === "/dashboard"
    : pathname === href;
}

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export const SidebarNav = memo(function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Rebuilt every render so the live `uiText` binding drives the language.
  const navItems = getNavItems();
  const navGroups = getNavGroups();

  const activeGroupKey = navGroups.find((g) =>
    g.items.some((item) => isActivePath(item.href, pathname))
  )?.key;

  const isGroupCollapsed = (key: string) =>
    key !== activeGroupKey && collapsedGroups.has(key);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = isActivePath(item.href, pathname);

    const link = (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
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

    if (collapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  if (collapsed) {
    return (
      <nav
        className="flex flex-col gap-1"
        aria-label={uiText.common.openMenuAriaLabel}
      >
        {navItems.map(renderLink)}
      </nav>
    );
  }

  return (
    <nav
      className="flex flex-col gap-4"
      aria-label={uiText.common.openMenuAriaLabel}
    >
      {navGroups.map((group) => {
        const isMain = group.key === "utama";
        const groupCollapsed = isGroupCollapsed(group.key);
        const contentId = `sidebar-group-${group.key}`;
        const headingClass =
          "flex w-full items-center justify-between gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors duration-150 hover:text-foreground";

        return (
          <div key={group.key}>
            {isMain ? (
              <p className={cn(headingClass, "cursor-default hover:text-muted-foreground")}>
                {group.label}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={!groupCollapsed}
                aria-controls={contentId}
                aria-label={`${groupCollapsed ? uiText.dashboard.expandSection : uiText.dashboard.collapseSection} ${group.label}`}
                className={cn(
                  headingClass,
                  "cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                {group.label}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-150",
                    groupCollapsed && "-rotate-90"
                  )}
                />
              </button>
            )}

            <div
              id={contentId}
              className={cn("flex flex-col gap-1", isMain ? "" : "mt-1")}
            >
              {!groupCollapsed && group.items.map(renderLink)}
            </div>
          </div>
        );
      })}
    </nav>
  );
});
