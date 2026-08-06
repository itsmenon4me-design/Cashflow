"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";

interface PermissionDeniedProps {
  title?: string;
  description?: string;
  className?: string;
}

export function PermissionDenied({
  title = "Akses Ditolak",
  description = "Anda tidak memiliki izin untuk mengakses halaman ini.",
  className,
}: PermissionDeniedProps) {
  const router = useRouter();

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-warning/10">
        <ShieldAlert className="size-8 text-warning" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <Button type="button" variant="secondary" onClick={() => router.push("/")}>
        {uiText.common.backToHome}
      </Button>
    </div>
  );
}