"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Home, ReceiptText, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";

interface MobileNavItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

function getMobileItems(): MobileNavItem[] {
  return [
    { label: uiText.navigation.dashboard, icon: Home, href: "/" },
    { label: uiText.navigation.transactions, icon: ReceiptText, href: "/transactions" },
    { label: uiText.navigation.reports, icon: BarChart3, href: "/reports" },
    { label: uiText.navigation.notifications, icon: Bell, href: "/notifications" },
    { label: uiText.navigation.profile, icon: UserRound, href: "/profile" },
  ];
}

export function MobileNav() {
  const pathname = usePathname();
  const mobileItems = getMobileItems();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label={uiText.common.primaryNavigationAriaLabel}
    >
      <div className="grid grid-cols-5">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
