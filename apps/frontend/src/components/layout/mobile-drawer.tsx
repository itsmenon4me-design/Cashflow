"use client";

import { useEffect } from "react";
import { Wallet } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialExpanded: Partial<Record<"transactions" | "planning" | "reports" | "system", boolean>>;
}

export function MobileDrawer({ open, onOpenChange, initialExpanded }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
        <SheetHeader className="flex-row items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <SheetTitle className="text-sidebar-foreground">CashFlow</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5 pt-4">
          <SidebarNav onNavigate={() => onOpenChange(false)} initialExpanded={initialExpanded} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
