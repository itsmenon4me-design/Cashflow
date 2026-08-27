"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, LogOut, MapPin, RefreshCw, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTransactionDate } from "@/lib/format";
import { getAccessToken } from "@/lib/auth-token";
import { sessionService } from "@/services/session.service";
import type { SessionItem } from "@/types/session";

function currentSessionId(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))?.sessionId ?? null;
  } catch {
    return null;
  }
}

function location(session: SessionItem) {
  return [session.city, session.country].filter(Boolean).join(", ") || "Lokasi tidak diketahui";
}

export function AuditLogPage() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const currentId = currentSessionId();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const sessions = await sessionService.list();
      setItems(sessions.sort((a, b) => Number(b.id === currentId) - Number(a.id === currentId)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [currentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const revoke = async (id: string) => {
    if (!window.confirm("Logout perangkat ini?")) return;
    await sessionService.revoke(id);
    await load();
  };

  const revokeOthers = async () => {
    if (!window.confirm("Logout semua perangkat lain?")) return;
    await sessionService.revokeOthers();
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Log Aktivitas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sesi aktif pada setiap perangkat.</p>
        </div>
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => void revokeOthers()} disabled={loading || items.filter((item) => item.id !== currentId).length === 0}>
          <LogOut /> Logout Perangkat Lain
        </Button>
      </div>
      {error ? <ErrorState title="Sesi tidak dapat dimuat" onRetry={() => void load()} /> : loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="rounded-xl border border-border p-4"><Skeleton className="h-5 w-48" /><Skeleton className="mt-3 h-4 w-64" /></div>)}</div>
      ) : items.length === 0 ? <EmptyState title="Tidak ada sesi aktif" icon={<ShieldCheck className="size-8 text-muted-foreground" />} /> : (
        <ul className="space-y-3">
          {items.map((session) => {
            const current = session.id === currentId;
            return <li key={session.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Laptop className="size-4 text-muted-foreground" /><p className="font-medium text-foreground">{session.device_name || session.browser || "Perangkat tidak diketahui"}</p>{current && <Badge>Perangkat ini</Badge>}</div>
                  <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{location(session)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><RefreshCw className="size-3" />Aktivitas terakhir {formatTransactionDate(session.last_activity_at)}</p>
                </div>
                {!current && <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void revoke(session.id)}><LogOut />Logout</Button>}
              </div>
            </li>;
          })}
        </ul>
      )}
    </div>
  );
}
