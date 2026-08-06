import { PageSkeleton } from "@/components/states/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonContainer } from "@/components/states/SkeletonContainer";

interface SettingsSkeletonProps {
  sections?: number;
}

export function SettingsSkeleton({ sections = 3 }: SettingsSkeletonProps) {
  return (
    <div className="space-y-6">
      <PageSkeleton />
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <SkeletonContainer key={sectionIndex} className="max-w-3xl">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-72" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 3 }).map((_, fieldIndex) => (
              <div key={fieldIndex} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-32" />
          </div>
        </SkeletonContainer>
      ))}
      <div className="flex max-w-3xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-10 rounded-full" />
      </div>
    </div>
  );
}