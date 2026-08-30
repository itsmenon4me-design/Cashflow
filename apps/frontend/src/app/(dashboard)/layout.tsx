import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

interface DashboardGroupLayoutProps {
  children: ReactNode;
}

const SIDEBAR_COOKIE = "cashflow_sidebar_expanded";
const SIDEBAR_COLLAPSED_COOKIE = "cashflow_sidebar_collapsed";

export default async function DashboardGroupLayout({ children }: DashboardGroupLayoutProps) {
  const cookieValue = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  let initialExpanded: Partial<Record<"transactions" | "planning" | "reports" | "system", boolean>> = {};
  const collapsedValue = (await cookies()).get(SIDEBAR_COLLAPSED_COOKIE)?.value;
  const initialCollapsed = collapsedValue === "true";

  if (cookieValue) {
    try {
      const parsed = JSON.parse(decodeURIComponent(cookieValue));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        initialExpanded = parsed;
      }
    } catch {
      // An invalid client cookie should not prevent the dashboard from rendering.
    }
  }

  return <DashboardLayout initialExpanded={initialExpanded} initialCollapsed={initialCollapsed}>{children}</DashboardLayout>;
}
