"use client";

import React from "react";
import { uiText } from "@/locales";

interface CenteredEmptyStateProps {
  title?: string;
  description?: string;
}

export default function CenteredEmptyState({ title, description }: CenteredEmptyStateProps) {
  const t = title ?? uiText.common.noDataAvailable;
  const d = description ?? "";
  return (
    <div className="flex h-full w-full items-center justify-center p-5">
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3h18v18H3V3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 16h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">{t}</p>
        {d ? <p className="mt-1 text-xs text-muted-foreground">{d}</p> : null}
      </div>
    </div>
  );
}
