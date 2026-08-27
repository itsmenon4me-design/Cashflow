"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Defers rendering (and therefore the dynamic-import chunk fetch) of heavy
 * children until `active` becomes true for the first time.
 *
 * Used for form/delete dialogs that are controlled via an `open` prop: the
 * dialog stays unmounted — and its react-hook-form + zod chunk stays
 * unloaded — until the user first triggers it, keeping page bundles small on
 * low-end devices. Once loaded it stays mounted so reopening is instant.
 */
export function LoadOnOpen({ active, children }: { active: boolean; children: ReactNode }) {
  const [loaded, setLoaded] = useState(active);

  useEffect(() => {
    if (active) {
      setLoaded(true);
    }
  }, [active]);

  return loaded ? <>{children}</> : null;
}
