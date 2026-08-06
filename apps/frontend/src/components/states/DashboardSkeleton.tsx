import { CardSkeleton } from "@/components/states/CardSkeleton";
import { ChartSkeleton } from "@/components/states/ChartSkeleton";
import { PageSkeleton } from "@/components/states/PageSkeleton";
import { TableSkeleton } from "@/components/states/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardSkeletonProps {
  cards?: number;
}

export function DashboardSkeleton({ cards = 4 }: DashboardSkeletonProps) {
  return (
    <div className="space-y-6">
      <PageSkeleton action={<Skeleton className="h-9 w-32" />} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <CardSkeleton key={index} rows={2} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      <TableSkeleton rows={5} columns={6} />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <CardSkeleton rows={3} />
        <CardSkeleton rows={3} />
        <CardSkeleton rows={3} />
      </div>
    </div>
  );
}