import { useEffect, useState } from "react";

/**
 * Returns true after the component has mounted on the client.
 * Use this to guard any rendering that depends on client-only state
 * (localStorage, Zustand stores, window APIs) to prevent hydration mismatches.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
