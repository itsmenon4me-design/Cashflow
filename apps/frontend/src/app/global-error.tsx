"use client";

import { TriangleAlert } from "lucide-react";

import { uiText } from "@/locales";

interface GlobalErrorPageProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function GlobalError({ error, retry }: GlobalErrorPageProps) {
  const handleRetry = () => {
    try {
      console.error(error);
    } catch {}
    retry();
  };

  return (
    <html lang="id">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center text-foreground">
        <p aria-hidden="true" className="text-6xl font-bold tracking-tight text-primary/40">
          500
        </p>
        <div className="flex size-16 items-center justify-center rounded-2xl bg-danger/10">
          <TriangleAlert className="size-8 text-danger" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{uiText.states.http500Title}</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {uiText.states.http500Description}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          {uiText.common.tryAgain}
        </button>
      </body>
    </html>
  );
}
