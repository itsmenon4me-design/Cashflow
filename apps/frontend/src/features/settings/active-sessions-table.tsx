"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HelpCircle,
  Laptop,
  LogOut,
  MoreVertical,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function DeviceIcon({ deviceType }: { deviceType: string | null }) {
  const normalizedType = deviceType?.trim().toLowerCase();
  const props = {
    className: "size-4 shrink-0 text-muted-foreground",
    "aria-hidden": true,
    "data-testid": `device-icon-${normalizedType || "unknown"}`,
  } as const;

  if (normalizedType === "mobile") return <Smartphone {...props} />;
  if (normalizedType === "tablet") return <Tablet {...props} />;
  if (normalizedType === "desktop") return <Laptop {...props} />;
  return <HelpCircle {...props} data-testid="device-icon-unknown" />;
}

function formatSessionTimestamp(date: string) {
  return formatTransactionDate(date).replace(" • ", ", ");
}

export function ActiveSessionsTable() {
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

  if (error) {
    return <ErrorState title="Sesi tidak dapat dimuat" onRetry={() => void load()} />;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border p-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-3 h-4 w-64" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title="Tidak ada sesi aktif" icon={<ShieldCheck className="size-8 text-muted-foreground" />} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {items.length} sesi aktif
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => void revokeOthers()}
          disabled={loading || items.filter((item) => item.id !== currentId).length === 0}
        >
          <LogOut className="size-4" />
          Logout Perangkat Lain
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Perangkat</th>
              <th scope="col" className="px-4 py-3 font-medium">
                <div>Lokasi</div>
                <div className="mt-1 max-w-56 text-xs font-normal leading-4 text-muted-foreground">
                  Lokasi berdasarkan estimasi jaringan, mungkin tidak 100% akurat.
                </div>
              </th>
              <th scope="col" className="px-4 py-3 font-medium">Dibuat</th>
              <th scope="col" className="px-4 py-3 font-medium">Diperbarui</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((session) => {
              const current = session.id === currentId;
              const device = [session.operating_system, session.browser].filter(Boolean).join(" · ")
                || session.device_name
                || "Perangkat tidak diketahui";
              return (
                <tr key={session.id} className="align-middle">
                  <td className="px-4 py-3">
                    <div className="flex min-w-[180px] items-center gap-2">
                      <DeviceIcon deviceType={session.device_type} />
                      <span className="font-medium text-foreground">{device}</span>
                      {current && <Badge className="shrink-0 text-xs">Perangkat ini</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{location(session)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatSessionTimestamp(session.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatSessionTimestamp(session.updated_at || session.last_activity_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {current ? (
                      <span className="text-muted-foreground" aria-label="Perangkat ini">
                        —
                      </span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="min-h-11 min-w-11 rounded-xl"
                            aria-label="Buka menu aksi perangkat"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => void revoke(session.id)}
                          >
                            <LogOut className="size-4" />
                            Log out
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
