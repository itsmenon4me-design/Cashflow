import { Skeleton } from "@/components/ui/skeleton";

interface SidebarSkeletonProps {
  items?: number;
}

export function SidebarSkeleton({ items = 8 }: SidebarSkeletonProps) {
  return (
    <div aria-hidden="true" className="flex h-full w-64 flex-col gap-2 border-r border-border p-4">
      <div className="mb-4 flex items-center gap-3 px-2">
        <Skeleton className="size-9 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className={index % 4 === 0 ? "h-4 w-32" : "h-4 w-24"} />
        </div>
      ))}
      <div className="mt-auto space-y-2 px-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}