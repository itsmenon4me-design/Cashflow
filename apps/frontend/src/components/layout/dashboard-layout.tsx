"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { HeaderBar } from "@/components/layout/header-bar";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarStore } from "@/stores/sidebar.store";
import { useAuthStore } from "@/stores/auth.store";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { QuickAddTransaction } from "@/components/transactions/quick-add-transaction";
import { useUiText } from "@/hooks/useUiText";

// Near-realtime global data refresh: bumps the shared refresh store on window
// focus/visibility so every page subscribed to dataVersion stays up to date
// without a manual page reload.
//
// A2: Throttle focus-triggered refreshes to once per 60s so rapid tab
// switching doesn't cause repeated refetches that visually look like a
// reload. The refetch itself is silent (stale-while-revalidate guards in
// each page keep old data on screen — see A3), but throttling reduces
// unnecessary network noise.
function useGlobalAutoRefresh() {
  useEffect(() => {
    const isAuthed = () => useAuthStore.getState().isAuthenticated;
    const MIN_INTERVAL_MS = 60_000; // 60 seconds
    let lastRefresh = 0;

    const refresh = () => {
      if (!isAuthed()) return;
      const now = Date.now();
      if (now - lastRefresh < MIN_INTERVAL_MS) return;
      lastRefresh = now;
      useDataRefreshStore.getState().bump();
    };

    // Perform an initial refresh and refresh when the window becomes visible or focused.
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
  }, []);
}

interface DashboardLayoutProps {
  children: ReactNode;
  initialExpanded: Partial<Record<"transactions" | "planning" | "reports" | "system", boolean>>;
  initialCollapsed: boolean;
}

export function DashboardLayout({ children, initialExpanded, initialCollapsed }: DashboardLayoutProps) {
  const { mobileOpen, setMobileOpen } = useSidebarStore();
  const text = useUiText();
  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useGlobalAutoRefresh();

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative mx-auto flex h-dvh w-full max-w-[1600px] overflow-hidden bg-background text-foreground">
        <Sidebar initialExpanded={initialExpanded} initialCollapsed={initialCollapsed} />
        <MobileDrawer open={mobileOpen} onOpenChange={setMobileOpen} />

        <div className="flex min-w-0 flex-1 flex-col">
          <HeaderBar />
          {/* min-height konsisten (viewport - header h-16) supaya halaman
              berkonten pendek tidak menyusutkan/menggeser main content (CLS fix):
              main flex-col + anak flex-1 memberi floor tinggi yang sama di semua menu */}
          {/* scrollbar-gutter: main adalah scroll container (bukan html) — tanpa
              gutter stabil, scrollbar yang muncul/hilang (mis. hasil filter
              kosong -> halaman memendek) mengubah lebar semua konten di dalamnya */}
          <main ref={mainRef} className="dashboard-main-scroll flex flex-1 flex-col overflow-y-auto px-4 pb-[calc(3.5625rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-10 md:pt-8 lg:px-8">
            <div className="grid flex-1 gap-6">
              <div className="min-h-full min-w-0 space-y-6">
                {/* Sidebar, header, and mobile navigation stay mounted while
                    only this route content changes. */}
                <RequireAuth
                  fallback={
                    <div
                      role="status"
                      aria-label={text.common.preparingPage}
                      aria-busy="true"
                      className="min-h-[calc(100dvh-8rem)]"
                    >
                      <span className="sr-only">{text.common.preparingPage}</span>
                    </div>
                  }
                >
                  {children}
                </RequireAuth>
              </div>
            </div>
          </main>
        </div>

        <MobileNav />
        <QuickAddTransaction showTrigger={false} />
      </div>
    </TooltipProvider>
  );
}
