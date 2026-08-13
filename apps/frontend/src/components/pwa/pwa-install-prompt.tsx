"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("beforeinstallprompt" in window)) {
      return;
    }

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setPromptEvent(null);

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!promptEvent || dismissed || !navigator.onLine) {
    return null;
  }

  const handleInstall = async () => {
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setPromptEvent(null);
      } else {
        setDismissed(true);
      }
    } catch {
      setDismissed(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Pasang aplikasi"
      className="fixed inset-x-3 bottom-20 z-50 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg md:inset-x-auto md:bottom-6 md:left-6 md:right-auto md:max-w-sm"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Download className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Pasang CashFlow</p>
        <p className="truncate text-xs text-muted-foreground">
          Buka tanpa koneksi internet, lebih cepat.
        </p>
      </div>
      <Button size="sm" className="shrink-0 rounded-xl" onClick={handleInstall}>
        Install
      </Button>
      <button
        type="button"
        aria-label="Tutup"
        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}