import { PageSkeleton } from "@/components/states/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/states/TableSkeleton";

interface TransactionsSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TransactionsSkeleton({ rows = 8, columns = 6 }: TransactionsSkeletonProps) {
  return (
    <div className="space-y-6">
      <PageSkeleton
        action={<Skeleton className="h-9 w-36" />}
        titleWidth="w-48"
        subtitleWidth="w-64"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-full max-w-56" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <TableSkeleton rows={rows} columns={columns} />
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}