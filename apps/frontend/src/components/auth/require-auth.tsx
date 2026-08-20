"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    // Debug: log auth state transitions
    try { console.log('[RequireAuth] mounted=', mounted, 'isAuthenticated=', isAuthenticated); } catch(e) {}
    if (mounted && !isAuthenticated) {
      console.log('[RequireAuth] not authenticated, redirecting to /login');
      router.replace("/login");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated) {
    try { console.log('[RequireAuth] returning null (suspending render) mounted=', mounted, 'isAuthenticated=', isAuthenticated); } catch(e) {}
    return null;
  }

  try { console.log('[RequireAuth] rendering children'); } catch(e) {}
  return <>{children}</>;
}