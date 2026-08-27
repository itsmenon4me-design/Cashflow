"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GenericPageSkeleton } from "@/components/skeletons/page-skeletons";
import { useAuthStore } from "@/stores/auth.store";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  // While auth state is not ready (or while redirecting to login), keep a stable
  // in-place loading state instead of rendering nothing. Rendering `null` here
  // unmounts the whole page content and produces the white flash users saw when
  // navigating or hard-refreshing protected routes. A page-shaped skeleton keeps
  // the layout footprint stable (no centered spinner on an empty screen).
  if (!hydrated || !isAuthenticated) {
    return <GenericPageSkeleton />;
  }

  return <>{children}</>;
}
