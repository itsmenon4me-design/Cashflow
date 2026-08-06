"use client";

import { useEffect, useState } from "react";

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

const FALLBACK_ONLINE = typeof navigator === "undefined" ? true : navigator.onLine;

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: FALLBACK_ONLINE,
    wasOffline: false,
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ isOnline: true, wasOffline: prev.wasOffline || !prev.isOnline }));
    };

    const handleOffline = () => {
      setStatus(() => ({ isOnline: false, wasOffline: true }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return status;
}