import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonContainer } from "@/components/states/SkeletonContainer";
import { cn } from "@/lib/utils";

interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

export function FormSkeleton({ fields = 4, className }: FormSkeletonProps) {
  return (
    <SkeletonContainer className={cn("max-w-2xl", className)}>
      <Skeleton className="h-5 w-44" />
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
    </SkeletonContainer>
  );
}