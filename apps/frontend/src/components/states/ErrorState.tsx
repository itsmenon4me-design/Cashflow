import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TriangleAlert, Headset } from "lucide-react";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";

/** Props for the reusable error state component */
interface ErrorStateProps {
  /** Optional title */
  title?: string;
  /** Optional description */
  description?: string;
  /** Optional error code */
  code?: number | string;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Additional class name for styling */
  className?: string;
}

/**
 * Reusable error state component.
 * Displays an error illustration, optional error code, title, description, and action buttons.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Terjadi kesalahan.",
  description = "Maaf, terjadi kendala saat memuat halaman. Silakan coba lagi.",
  code,
  onRetry,
  className,
}) => {
  return (
    <Card className={cn("flex flex-col items-center justify-center gap-4 p-8 text-center", className)}>
      <div className="flex size-16 items-center justify-center rounded-2xl bg-danger/10">
        <TriangleAlert className="size-8 text-danger" aria-hidden="true" />
      </div>
      <CardHeader className="space-y-1">
        {code && (
          <CardDescription className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
            {code}
          </CardDescription>
        )}
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        {description && (
          <CardDescription className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {uiText.common.tryAgain}
          </Button>
        )}
        <Button variant="outline" onClick={() => undefined}>
          <Headset className="mr-2 size-4" />
          {uiText.common.contactSupport}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ErrorState;