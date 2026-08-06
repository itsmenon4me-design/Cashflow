import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Tailwind size classes (e.g., "h-4 w-full"). Defaults to a single text line. */
  className?: string;
}

/**
 * Generic loading state component using shadcn/ui `Skeleton`.
 * Sized through Tailwind classes so dimensions match the final UI and avoid layout shift.
 */
export function LoadingState({ className }: LoadingStateProps) {
  return <Skeleton aria-hidden="true" className={cn("h-4 w-full", className)} />;
}

export default LoadingState;