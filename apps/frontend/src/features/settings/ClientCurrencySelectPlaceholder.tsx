"use client";

import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CURRENCY_OPTIONS } from "@/types/settings";

export default function ClientCurrencySelectPlaceholder({ currency, persistError, onChange }: { currency: string; persistError: string | null; onChange: (v: string) => void }) {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    try {
      // AppProviders sets this flag when client hydration has finished.
      setClientReady(Boolean((window as any).__app_client_ready));
    } catch (e) {
      setClientReady(false);
    }
    // also set a short timeout as a fallback to let client mount proceed
    const t = setTimeout(() => setClientReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!clientReady) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor="settings-currency" className="text-xs text-muted-foreground">Currency</Label>
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="settings-currency" className="text-xs text-muted-foreground">Currency</Label>
      <Select value={currency} onValueChange={(v) => onChange(v)}>
        <SelectTrigger id="settings-currency" className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CURRENCY_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {persistError && <p className="text-sm text-destructive mt-1">{persistError}</p>}
    </div>
  );
}
