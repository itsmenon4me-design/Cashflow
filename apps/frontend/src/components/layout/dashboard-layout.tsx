"use client";

import { useEffect, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { HeaderBar } from "@/components/layout/header-bar";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarStore } from "@/stores/sidebar.store";
import { useAuthStore } from "@/stores/auth.store";
import { useDataRefreshStore } from "@/stores/refresh.store";

const AUTO_REFRESH_MS = 30000;

// Near-realtime global data refresh: bumps the shared refresh store periodically
// and on window focus so every page subscribed to dataVersion stays up to date
// without a manual page reload.
function useGlobalAutoRefresh() {
  useEffect(() => {
    const isAuthed = () => useAuthStore.getState().isAuthenticated;
    const refresh = () => {
      if (isAuthed()) {
        useDataRefreshStore.getState().bump();
      }
    };

    const interval = window.setInterval(refresh, AUTO_REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { mobileOpen, setMobileOpen } = useSidebarStore();

  useGlobalAutoRefresh();

  useEffect(() => {
    try { console.log('[DashboardLayout] mount'); } catch(e) {}
    return () => { try { console.log('[DashboardLayout] unmount'); } catch(e) {} };
  }, []);

  try { console.log('[DashboardLayout] rendering children, mobileOpen=', mobileOpen); } catch(e) {}

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] bg-background text-foreground">
        <Sidebar />
        <MobileDrawer open={mobileOpen} onOpenChange={setMobileOpen} />

        <div className="flex min-w-0 flex-1 flex-col">
          <HeaderBar />
          <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-8 lg:px-8">
            <div className="grid gap-6">
              <div className="min-w-0 space-y-6">
                <RequireAuth>{children}</RequireAuth>
              </div>
            </div>
          </main>
        </div>

        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
