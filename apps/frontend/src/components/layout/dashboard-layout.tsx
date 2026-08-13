"use client";

import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { HeaderBar } from "@/components/layout/header-bar";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RightPanel } from "@/components/layout/right-panel";
import { Sidebar } from "@/components/layout/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarStore } from "@/stores/sidebar.store";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { mobileOpen, setMobileOpen } = useSidebarStore();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] bg-background text-foreground">
        <Sidebar />
        <MobileDrawer open={mobileOpen} onOpenChange={setMobileOpen} />

        <div className="flex min-w-0 flex-1 flex-col">
          <HeaderBar />
          <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-8 lg:px-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-6">
                <RequireAuth>{children}</RequireAuth>
              </div>
              <RightPanel />
            </div>
          </main>
        </div>

        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
