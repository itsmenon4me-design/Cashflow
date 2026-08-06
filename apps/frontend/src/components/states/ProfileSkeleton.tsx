import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonContainer } from "@/components/states/SkeletonContainer";

interface ProfileSkeletonProps {
  className?: string;
}

export function ProfileSkeleton({ className }: ProfileSkeletonProps) {
  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <Skeleton className="size-20 rounded-full" />
        <div className="space-y-2 text-center sm:text-left">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      <SkeletonContainer className="mt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </SkeletonContainer>

      <SkeletonContainer className="mt-6">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-9 w-32" />
        </div>
      </SkeletonContainer>
    </div>
  );
}