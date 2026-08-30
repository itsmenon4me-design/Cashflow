import {
  getAccessToken,
  getAccessTokenAgeMs,
  getRefreshToken,
  setAuthTokens,
  clearAuthTokens,
} from "@/lib/auth-token";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api/v1";

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

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  refresh?: boolean;
  signal?: AbortSignal;
}

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
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
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;

  if (!refreshed) {
    redirectToLogin();
  }

  return refreshed;
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
  return doRefresh();
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

async function request<T>(
  path: string,
  method: string,
  options: RequestOptions = {},
  body?: unknown,
): Promise<T> {
  const { headers = {}, params, refresh = true, signal } = options;

  const url = buildUrl(path, params);

  // Tokens live synchronously in localStorage, so no waiting is needed here.
  // Waiting for React hydration before reading storage only delays requests and
  // makes route transitions feel slow/blank.
  const accessToken = getAccessToken();

  const doFetch = (token: string | null) =>
    fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
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
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, "GET", options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, "POST", options, body),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, "PATCH", options, body),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, "DELETE", options),
};
