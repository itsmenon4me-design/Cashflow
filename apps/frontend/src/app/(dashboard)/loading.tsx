import { DashboardSkeleton } from "@/components/skeletons/page-skeletons";

// Route-group fallback for any dashboard segment without its own loading.tsx.
// Shaped like the dashboard home page so the loading state matches the most
// common content footprint instead of a generic centered spinner.
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
