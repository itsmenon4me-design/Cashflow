"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUiText } from "@/hooks/useUiText";
import {
  notificationService,
  type WebPushConfig,
} from "@/services/notification.service";

type PushPermission = NotificationPermission | "unsupported";

function supportsPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function toApplicationServerKey(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return buffer;
}

async function getPushRegistration(
  createIfMissing = true,
): Promise<ServiceWorkerRegistration | null> {
  const scope = new URL("/push/", window.location.origin).href;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const existing = registrations.find(
    (registration) => registration.scope === scope,
  );
  if (existing || !createIfMissing) return existing ?? null;
  return navigator.serviceWorker.register("/push/sw.js", { scope: "/push/" });
}

export function PushNotificationSettings() {
  const text = useUiText();
  const [config, setConfig] = useState<WebPushConfig | null>(null);
  const [permission, setPermission] = useState<PushPermission>("default");
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let isSupported = false;
    try {
      isSupported = supportsPush();
      const pushConfig = await notificationService.pushConfig();
      setSupported(isSupported);
      setPermission(
        isSupported ? window.Notification.permission : "unsupported",
      );
      setConfig(pushConfig);

      if (isSupported && window.Notification.permission === "granted") {
        const registration = await getPushRegistration(pushConfig.enabled);
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          setSubscribed(true);
          const data = subscription.toJSON();
          if (!data.endpoint || !data.keys?.p256dh || !data.keys.auth) {
            throw new Error(
              "The browser returned an incomplete push subscription.",
            );
          }
          if (pushConfig.enabled) {
            await notificationService.savePushSubscription({
              endpoint: data.endpoint,
              keys: { p256dh: data.keys.p256dh, auth: data.keys.auth },
            });
          }
        }
      }
    } catch {
      setSupported(isSupported);
      setPermission(
        isSupported ? window.Notification.permission : "unsupported",
      );
      setError(text.settingsPage.pushLoadError);
    } finally {
      setLoading(false);
    }
  }, [text.settingsPage.pushLoadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!supportsPush()) {
        setPermission("unsupported");
        return;
      }
      if (!config?.enabled || !config.publicKey) {
        setError(text.settingsPage.pushUnavailable);
        return;
      }

      const nextPermission = await window.Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        if (nextPermission === "denied") {
          setError(text.settingsPage.pushDenied);
        }
        return;
      }

      const registration = await getPushRegistration();
      if (!registration) {
        throw new Error("Push service worker registration is unavailable.");
      }
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(config.publicKey),
        }));
      const data = subscription.toJSON();
      if (!data.endpoint || !data.keys?.p256dh || !data.keys.auth) {
        throw new Error(
          "The browser returned an incomplete push subscription.",
        );
      }

      await notificationService.savePushSubscription({
        endpoint: data.endpoint,
        keys: { p256dh: data.keys.p256dh, auth: data.keys.auth },
      });
      setSubscribed(true);
    } catch {
      setError(text.settingsPage.pushEnableError);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const pushScope = new URL("/push/", window.location.origin).href;
      const registration = registrations.find(
        (item) => item.scope === pushScope,
      );
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await notificationService.removePushSubscription(endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError(text.settingsPage.pushDisableError);
    } finally {
      setBusy(false);
    }
  };

  const statusMessage = loading
    ? text.settingsPage.pushChecking
    : busy
      ? text.settingsPage.pushSaving
      : !supported
        ? text.settingsPage.pushUnsupported
        : subscribed
          ? text.settingsPage.pushEnabled
          : permission === "denied"
            ? text.settingsPage.pushDenied
            : null;

  return (
    <div className="col-span-full flex flex-col gap-4 rounded-xl border border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {subscribed ? (
            <Bell className="size-4" aria-hidden="true" />
          ) : (
            <BellOff className="size-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {text.settingsPage.pushTitle}
          </p>
          {(error || statusMessage) && (
            <p
              role={error ? "alert" : "status"}
              aria-live={error ? "assertive" : "polite"}
              className={
                error
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {error ?? statusMessage}
            </p>
          )}
        </div>
      </div>
      <Switch
        checked={subscribed}
        aria-label={`${text.settingsPage.pushTitle}: ${
          subscribed
            ? text.settingsPage.pushDisable
            : text.settingsPage.pushEnable
        }`}
        disabled={
          loading ||
          busy ||
          !supported ||
          permission === "denied"
        }
        onCheckedChange={(checked) =>
          void (checked ? enable() : disable())
        }
      />
    </div>
  );
}
