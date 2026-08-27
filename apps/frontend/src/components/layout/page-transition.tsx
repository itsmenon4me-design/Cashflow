"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { usePathname } from "next/navigation";

// Timing contract requested for route changes: ~150ms fade-out of the old
// page, ~150-200ms fade-in of the new one. Pure opacity only — no translate/
// scale — so nothing inside <main> shifts layout during the transition.
const EXIT_DURATION_S = 0.15;
const ENTER_DURATION_S = 0.18;

interface PageTransitionProps {
  children: ReactNode;
  /**
   * Fired after the old page finished fading out and before the new page
   * starts fading in. The layout uses this to reset scroll while the content
   * area is empty, so the user never sees the old page jump to the top.
   */
  onExited?: () => void;
}

/**
 * Cross-page fade transition wrapper for the dashboard content area.
 *
 * Keyed by pathname: when the route changes, AnimatePresence keeps the old
 * page mounted just long enough to fade it out (mode="wait"), then fades the
 * new page in. Sidebar/header live OUTSIDE this component in the persistent
 * dashboard layout, so they never re-mount or blink during navigation.
 *
 * `initial={false}` disables the fade on first load/hydration; `MotionConfig
 * reducedMotion="user"` keeps the fade for everyone else while respecting
 * users who opt out of non-essential motion (opacity is retained by design).
 */
export function PageTransition({ children, onExited }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false} onExitComplete={onExited}>
        <motion.div
          key={pathname}
          data-slot="page-transition"
          className="min-w-0"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: ENTER_DURATION_S, ease: "easeOut" },
          }}
          exit={{
            opacity: 0,
            transition: { duration: EXIT_DURATION_S, ease: "easeIn" },
          }}
        >
          {/* Suspense boundary below the animated slot: if a page suspends
              during a client navigation (e.g. route chunk still downloading),
              its fallback appears inside the fading-in container instead of
              replacing the whole exiting tree, preserving the fade. Also
              satisfies build-time prerender requirements for pages that read
              useSearchParams(). */}
          <Suspense fallback={<div className="min-h-[60vh]" aria-hidden="true" />}>
            {children}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
