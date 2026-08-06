import type { ReactNode } from "react";
import { FileQuestion, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface HttpErrorPageProps {
  statusCode: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function HttpErrorPage({
  statusCode,
  title,
  description,
  icon: Icon = FileQuestion,
  action,
  className,
}: HttpErrorPageProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center text-foreground",
        className
      )}
    >
      <p
        aria-hidden="true"
        className="text-6xl font-bold tracking-tight text-primary/40"
      >
        {statusCode}
      </p>
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}