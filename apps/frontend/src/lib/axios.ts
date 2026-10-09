import {
  getAccessToken,
  getAccessTokenAgeMs,
  getRefreshToken,
  setAuthTokens,
  clearAuthTokens,
} from "@/lib/auth-token";
import {
  DemoApiError,
  getDemoResponse,
  isDemoApiRoute,
  isDemoDataMode,
  mutateDemoResponse,
} from "@/lib/demo-api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api/v1";
export const API_REQUEST_TIMEOUT_MS = 20_000;
const DEVICE_ID_STORAGE_KEY = "cashflow.auth.device-id";
let cachedDeviceId: string | null = null;

export function getBrowserDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  if (cachedDeviceId) return cachedDeviceId;

  const stored = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  const deviceId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  cachedDeviceId = deviceId;
  return deviceId;
}

export function buildApiUrl(path: string, params?: URLSearchParams): string {
  const query = params?.toString();
  return `${BASE_URL.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}${query ? `?${query}` : ""}`;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export class ApiTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "ApiTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  refresh?: boolean;
  signal?: AbortSignal;
}

let refreshPromise: Promise<boolean> | null = null;

async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let externalAbortHandler: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ApiTimeoutError(API_REQUEST_TIMEOUT_MS));
      controller.abort();
    }, API_REQUEST_TIMEOUT_MS);
  });
  const externalAbort = externalSignal
    ? new Promise<never>((_, reject) => {
        externalAbortHandler = () => {
          const reason =
            externalSignal.reason ??
            new DOMException("The request was aborted", "AbortError");
          controller.abort(reason);
          reject(reason);
        };
        if (externalSignal.aborted) externalAbortHandler();
        else externalSignal.addEventListener("abort", externalAbortHandler, { once: true });
      })
    : null;

  try {
    const operationPromise = operation(controller.signal);
    return await Promise.race(
      externalAbort
        ? [operationPromise, timeout, externalAbort]
        : [operationPromise, timeout],
    );
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener("abort", externalAbortHandler);
    }
  }
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    return await withRequestTimeout(async (signal) => {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        signal,
      });

      if (!response.ok) {
        return false;
      }

      const json: unknown = await response.json();
      const data = typeof json === "object" && json !== null && "data" in json
        ? (json as { data?: { accessToken?: string; refreshToken?: string } }).data
        : undefined;

      if (data?.accessToken && data.refreshToken) {
        setAuthTokens(data.accessToken, data.refreshToken);
        return true;
      }

      return false;
    });
  } catch {
    return false;
  }
}

// When a refresh genuinely fails, several concurrent requests can observe the
// same failure and each would try to navigate to /login. Collapse that into a
// single navigation within a short window so the UI does not flicker/remount
// multiple times.
const LOGIN_REDIRECT_DEBOUNCE_MS = 1500;
let lastLoginRedirectAt = 0;

function redirectToLogin(): void {
  const now = Date.now();
  if (now - lastLoginRedirectAt < LOGIN_REDIRECT_DEBOUNCE_MS) {
    return;
  }
  lastLoginRedirectAt = now;

  clearAuthTokens();
  try {
    if (typeof window !== "undefined") {
      const path = "/login";
      const clientReady = (window as any).__app_client_ready === true;
      // If the client shell is ready, dispatch the client-route event to navigate.
      // If not yet ready (hydration in progress), queue the intended route so the
      // AppProviders can perform navigation once it finishes hydrating. This
      // prevents dispatching navigation during hydration which can trigger
      // unnecessary remounts or blank flashes.
      if (clientReady) {
        if (window.location.pathname !== path) {
          window.dispatchEvent(new CustomEvent("cashflow:client-route", { detail: path }));
        }
      } else {
        // Queue pending client route for AppProviders to handle after hydration
        (window as any).__app_pending_client_route = path;
      }
    }
  } catch {
    // In restricted runtimes, navigation may be unsupported - fail silently
  }
}

async function handleUnauthorized(): Promise<boolean> {
  const refreshed = await refreshAccessToken();

  if (!refreshed) {
    redirectToLogin();
  }

  return refreshed;
}

function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Default staleness window: access tokens are short-lived (JWT exp), so any
// token older than this is proactively rotated before an important batch of
// authenticated work (e.g. flushing the offline sync queue) to avoid burning
// the first queue items on predictable 401s.
const DEFAULT_TOKEN_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Proactively rotate the access token when it is older than `maxAgeMs`.
 * Returns true when a valid token is available afterwards (fresh or still
 * young enough), false when the refresh attempt failed (session expired).
 */
export async function ensureFreshAccessToken(
  maxAgeMs: number = DEFAULT_TOKEN_MAX_AGE_MS,
): Promise<boolean> {
  if (!getRefreshToken()) {
    return Boolean(getAccessToken());
  }
  if (getAccessTokenAgeMs() <= maxAgeMs) {
    return Boolean(getAccessToken());
  }
  return refreshAccessToken();
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) {
      query.set(key, String(value));
    }
  }
  return `${BASE_URL}${path}${query.size > 0 ? `?${query.toString()}` : ""}`;
}

const GET_CACHE_TTL_MS = 60_000;

interface GetCacheEntry {
  data: unknown;
  storedAt: number;
  revalidating: boolean;
}

const getCache = new Map<string, GetCacheEntry>();
let getCacheGeneration = 0;

function getCacheKey(url: string): string {
  return `${getAccessToken() ?? ""}\n${url}`;
}

function invalidateGetCache(): void {
  getCacheGeneration += 1;
  getCache.clear();
}

async function request<T>(
  path: string,
  method: string,
  options: RequestOptions = {},
  body?: unknown,
): Promise<T> {
  const { headers = {}, params, refresh = true, signal } = options;

  if (isDemoDataMode() && isDemoApiRoute(path)) {
    if (method === "GET") {
      const demoResponse = getDemoResponse(path, params);
      if (demoResponse === undefined) {
        throw new ApiError(501, {
          success: false,
          message: `Endpoint data demo belum tersedia: ${path}`,
        });
      }
      return demoResponse as T;
    }

    try {
      const demoResponse = mutateDemoResponse(path, method, body);
      if (demoResponse === undefined) {
        throw new ApiError(501, {
          success: false,
          message: `Aksi data demo belum tersedia: ${method} ${path}`,
        });
      }
      return demoResponse as T;
    } catch (error) {
      if (error instanceof DemoApiError) {
        throw new ApiError(error.status, { success: false, message: error.message });
      }
      throw error;
    }
  }

  const url = buildUrl(path, params);

  return withRequestTimeout(async (requestSignal) => {
    // Tokens live synchronously in localStorage, so no waiting is needed here.
    const accessToken = getAccessToken();
    const deviceId = getBrowserDeviceId();

    const doFetch = (token: string | null) =>
      fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(deviceId ? { "X-Device-Id": deviceId } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: requestSignal,
      });

    let response = await doFetch(accessToken);

    if (response.status === 401 && refresh) {
      const refreshed = await handleUnauthorized();
      if (refreshed) {
        response = await doFetch(getAccessToken());
      }
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, data);
    }

    return data as T;
  }, signal);
}

async function getWithCache<T>(path: string, options?: RequestOptions): Promise<T> {
  const url = buildUrl(path, options?.params);
  const key = getCacheKey(url);
  const cached = getCache.get(key);

  if (cached && Date.now() - cached.storedAt < GET_CACHE_TTL_MS) {
    return cached.data as T;
  }

  if (cached) {
    if (!cached.revalidating) {
      cached.revalidating = true;
      const generation = getCacheGeneration;
      void request<T>(path, "GET", options)
        .then((data) => {
          if (generation === getCacheGeneration) {
            getCache.set(key, { data, storedAt: Date.now(), revalidating: false });
          }
        })
        .catch(() => {
          if (generation === getCacheGeneration) {
            const current = getCache.get(key);
            if (current) current.revalidating = false;
          }
        });
    }
    return cached.data as T;
  }

  const data = await request<T>(path, "GET", options);
  getCache.set(key, { data, storedAt: Date.now(), revalidating: false });
  return data;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => getWithCache<T>(path, options),
  post: async <T>(path: string, body?: unknown, options?: RequestOptions) => {
    const data = await request<T>(path, "POST", options, body);
    invalidateGetCache();
    return data;
  },
  patch: async <T>(path: string, body?: unknown, options?: RequestOptions) => {
    const data = await request<T>(path, "PATCH", options, body);
    invalidateGetCache();
    return data;
  },
  delete: async <T>(path: string, options?: RequestOptions) => {
    const data = await request<T>(path, "DELETE", options);
    invalidateGetCache();
    return data;
  },
};
