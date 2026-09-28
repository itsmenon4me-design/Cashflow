"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Home, Plus, ReceiptText, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import { warmRouteData } from "@/lib/route-data-prefetch";
import { useAddTransactionStore } from "@/stores/add-transaction.store";

interface MobileNavItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

function getMobileItems(): MobileNavItem[] {
  return [
    { label: "Beranda", icon: Home, href: "/dashboard" },
    { label: "Transaksi", icon: ReceiptText, href: "/transactions" },
    { label: "Tambah", icon: Plus, href: "/transactions?add=1" },
    { label: "Laporan", icon: BarChart3, href: "/reports" },
    { label: "Profil", icon: UserRound, href: "/profile" },
  ];
}

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openDialog = useAddTransactionStore((state) => state.openDialog);
  const mobileItems = getMobileItems();

  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label={uiText.common.primaryNavigationAriaLabel}
    >
      <div className="grid grid-cols-5">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const [itemPath, itemQuery] = item.href.split("?");
          const isDashboardItem = itemPath === "/dashboard";
          const isCurrentPath = isDashboardItem
            ? pathname === "/" || pathname === "/dashboard"
            : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
          const isActive = itemQuery
            ? pathname === itemPath && searchParams.toString().includes(itemQuery)
            : searchParams.get("add") !== "1" && isCurrentPath;

          return (
            itemQuery === "add=1" ? (
              <button
                key={item.label}
                type="button"
                aria-pressed={isActive}
                onClick={openDialog}
                className={cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                <span className="truncate text-[10px] font-medium">{item.label}</span>
              </button>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                prefetch
                aria-current={isActive ? "page" : undefined}
                onPointerDown={() => {
                  if (!isCurrentPath) {
                    window.dispatchEvent(
                      new CustomEvent("cashflow:navigate", { detail: itemPath }),
                    );
                  }
                }}
                onClick={(event) => {
                  if (event.detail === 0 && !isCurrentPath) {
                    window.dispatchEvent(
                      new CustomEvent("cashflow:navigate", { detail: itemPath }),
                    );
                  }
                }}
                onMouseEnter={() => warmRouteData(item.href)}
                onFocus={() => warmRouteData(item.href)}
                onTouchStart={() => warmRouteData(item.href)}
                className={cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                <span className="truncate text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          );
        })}
      </div>
    </nav>
  );
}
